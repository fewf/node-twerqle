// "use strict";
// Optional. You will see this name in eg. 'ps' or 'top' command
process.title = 'node-twerqle';
 
// Port where we'll run the websocket server
var webSocketsServerPort = 1337;
 
// websocket and http servers
var webSocketServer = require('websocket').server;
var http = require('http');
var state = require('./state');
var _ = require('underscore');
 
/**
 * Global variables
 */
// latest 100 messages
var chatHistory = [ ];
// list of currently connected clients (users)
var clients = [ ];

var game;
/**
 * Helper function for escaping input strings
 */
function htmlEntities(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;')
                      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
/**
 * HTTP server
 */
var server = http.createServer(function(request, response) {
    // Not important for us. We're writing WebSocket server, not HTTP server
});
server.listen(webSocketsServerPort, function() {
    console.log((new Date()) + " Server is listening on port " + webSocketsServerPort);
});
 
/**
 * WebSocket server
 */
var wsServer = new webSocketServer({
    // WebSocket server is tied to a HTTP server. WebSocket request is just
    // an enhanced HTTP request. For more info http://tools.ietf.org/html/rfc6455#page-6
    httpServer: server
});
 
// This callback function is called every time someone
// tries to connect to the WebSocket server
wsServer.on('request', function(request) {
    console.log((new Date()) + ' Connection from origin ' + request.origin + '.');
 
    // accept connection - you should check 'request.origin' to make sure that
    // client is connecting from your website
    // (http://en.wikipedia.org/wiki/Same_origin_policy)
    var connection = request.accept(null, request.origin); 
    var clientObj = {
        conn: connection,
    }
    // we need to know client index to remove them on 'close' event
    var index = clients.push(clientObj) - 1;
    var userName = false;
    
    // define some helper funcs

    function broadcast(json) {
        console.log('broadcast json' + json);
        console.log(json);
        for (var i=0; i < clients.length; i++) {
            clients[i].conn.sendUTF(json);
        }
    }

    function broadcastToOthers(json) {
        console.log('broadcast to all but current player');
        console.log(json);
        for (var i=0; i < clients.length; i++) {
            if (i !== index) clients[i].conn.sendUTF(json);
        }
    }

    function sendToThisConn(json) {
        console.log('broadcast to only current player');
        console.log(json);
        clients[index].conn.sendUTF(json);
    }

    function sendError(errorMsg, optionalMsgs) {
        var obj = _.extend( {error: errorMsg}, optionalMsgs );
        console.log('send error');
        console.log(obj);
        var json = JSON.stringify({ type: 'error', data: obj });
        sendToThisConn(json);
    }

    function startGame() {
        if (game) {
            sendError( 'Game already started' );
            return;
        }
        playerNames = _.pluck(clients, 'name');
        playerTypes = state.repeatElements([0], clients.length);
        game = state.initState(playerNames, playerTypes, 6, 3);
        var obj = {
            players: game.players,
            startIndex: game.startIndex
        };
        var json = JSON.stringify({ type:'start game', data: obj });
        broadcast(json);
    }

    function playClientMoves(moves) {
        for (var i = 0; i < moves.length; i+=3) {
            var tileNum = Number(moves[i]);
            var row = Number(moves[i+1]);
            var col = Number(moves[i+2]);
            if (!game.placeTile(tileNum, row, col)) {
                var errMsg = 'Cannot play tile ' + tileNum + ' at ' + row + ', ' + col;
                var clientAction = { clientAction: 'reset turn' };
                console.log(errMsg);
                game.resetTurn();
                sendError(errMsg, clientAction);
                return false;
            }
        };
        return true;
    }

    function endTurnSuccess(moves) {
        console.log('turn success');

        var result = game.endTurn();
        var newTiles = result[2];
        broadcastToOthers(JSON.stringify(
                                          { 
                                           type: 'opponent play',
                                           data: moves 
                                          }
                                        )
                          );

        sendToThisConn(JSON.stringify({
                                        type: 'turn success',
                                        data: newTiles
                                      }));
    }

    function initNewUser(msgData) {
        userName = htmlEntities(msgData);
        clients[index].name = userName;
        names = _.pluck(clients, 'name');
        console.log((new Date()) + ' User is known as: ' + userName );
        var json = JSON.stringify({ type: 'user join', data: names });
        broadcast(json, clients);
    }

    function routeMsg(msgType, msgData) {
        console.log(msgType);
        console.log(msgData);
        switch (msgType) {

            case 'chat':
                if (!userName) {
                    initNewUser(msgData);
                } else {
                    console.log((new Date()) + ' Received Message from '
                                + userName + ': ' + msgData);
                    // we want to keep chatHistory of all sent messages
                    var obj = {
                        time: (new Date()).getTime(),
                        text: htmlEntities(msgData),
                        author: userName
                    };
                    chatHistory.push(obj);
                    chatHistory = chatHistory.slice(-100);
     
                    // broadcast message to all connected clients
                    var json = JSON.stringify({ type:'message', data: obj });
                    broadcast(json, clients);
                }
                break;
            case 'start game':

                startGame();
                break;

            case 'end turn':

                var moves = msgData.split(/[trc]/).slice(1);
                if (playClientMoves(moves)) {
                    endTurnSuccess(moves);
                }
                break;

            case 'exchange':

                var exchangeTiles = msgData.split('-')
                                           .map(function(x) {
                                                return Number(x);
                                           });
                console.log('rack before exchange' + game.players[index].tiles);
                var result = game.exchangeTiles(exchangeTiles);
                console.log('rack after exchange' + game.players[index].tiles);
                var newRack = game.players[index].tiles;
                var obj = {
                    oldTiles: exchangeTiles,
                    newTiles: newRack
                }
                if (result) {
                    var json = JSON.stringify({ type: 'exchange success', data: obj });
                    sendToThisConn(json);
                    var json = JSON.stringify({ type: 'opponent exchange', data: exchangeTiles.length });
                    broadcastToOthers(json);
                } else {
                    sendError('Tile exchange failed', { clientAction: 'clear selected tiles'} );
                }
                break;

        }
    }

    console.log((new Date()) + ' Connection accepted.');
 
    // send back chat chatHistory
    // if (chatHistory.length > 0) {
    //     sendToThisConn(JSON.stringify( { type: 'chatHistory', data: chatHistory} ));
    // }
 
    // user sent some message
    connection.on('message', function(message) {
        if (message.type === 'utf8') { // accept only text

            var parseMsg = message.utf8Data.split('>>');
            var msgType = parseMsg[0];
            var msgData = parseMsg[1];

            routeMsg(msgType, msgData);
        }
    });
 
    // user disconnected
    connection.on('close', function(connection) {
        if (userName !== false) {
            console.log(connection);
            console.log((new Date()) + " Peer "
                + connection.remoteAddress + " disconnected.");
            // remove user from the list of connected clients
            clients.splice(index, 1);
        }
    });
 
});