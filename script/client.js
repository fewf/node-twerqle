$(document).ready(function() {

    "use strict";
    // for better performance - to avoid searching in DOM
    window.ui = { };
    ui.chat = $('#chatUI');
    ui.content = $('#chatMessages');
    ui.input = $('#chatInput');
    ui.chatName = $('#chatName');
    ui.status = $('#chatStatus');
    ui.userNames = $('#usernames');

    // my name sent to the server
    var myName = false;


    // if user is running mozilla then use it's built-in WebSocket
    window.WebSocket = window.WebSocket || window.MozWebSocket;

    // if browser doesn't support WebSocket, just show some notification and exit
    if (!window.WebSocket) {
            ui.content.html($('<p>', { text: 'Sorry, but your browser doesn\'t '
                                                                    + 'support WebSockets.'} ));
            ui.input.hide();
            $('span').hide();
            return;
    }

    window.io = {};
    // open connection
    io.connection = new WebSocket('ws://127.0.0.1:1337');

    io.connection.onopen = function () {
            // first we want users to enter their names
            ui.input.removeAttr('disabled');
            ui.chatName.text('Choose name:');
    };

    io.connection.onerror = function (error) {
            // just in there were some problems with conenction...
            ui.content.html($('<p>', { text: 'Sorry, but there\'s some problem with your '
                                                                    + 'connection or the server is down.' } ));
    };

    // most important part - incoming messages
    io.connection.onmessage = function (message) {
            // try to parse JSON message. Because we know that the server always returns
            // JSON this should work without any problem but we should make sure that
            // the massage is not chunked or otherwise damaged.
            console.log(message.data);
            try {
                    var json = JSON.parse(message.data);
            } catch (e) {
                    console.log('This doesn\'t look like a valid JSON: ', message.data);
                    return;
            }

            // NOTE: if you're not sure about the JSON structure
            // check the server source code above

            routeMessage(json);
            
    };

    /**
     * Send mesage when user presses Enter key
     */
    $(ui.input).keydown(function(e) {
            if (e.keyCode === 13) {
                    var msg = $(this).val();
                    if (!msg) {
                            return;
                    }
                    // send the message as an ordinary text
                    if (msg) {
                        console.log('send chat' + msg);
                        io.connection.send('chat>>' + msg);
                    }
                    $(this).val('');
                    // disable the input field to make the user wait until server
                    // sends back response
                    ui.input.attr('disabled', 'disabled');

                    // we know that the first message sent from a user their name
                    if (myName === false) {
                            myName = msg;
                    }
            }
    });
    
    function routeError(errMsg, clientAction) {
        console.log(errMsg);
        switch (clientAction) {
            case 'reset turn':
                game.resetTurn();
                break;
            case 'clear selected tiles':
                $('img.selected').removeClass('selected');
                break;
        }
    }

    function routeMessage(json) {
        switch (json.type) {

            case 'history':
                displayHistory(json.data);
                break;

            case 'user join':
                initUser(json.data);
                break;

            case 'chat':
                postNewChat(json.data);
                break;

            case 'start game':
                startGame(json.data);
                break;

            case 'turn success':
                turnSuccess(json.data);
                break;

            case 'exchange success':
                exchangeSuccess(json.data);
                break;

            case 'error':
                routeError(json.data);
                break;

            case 'opponent exchange':
                opponentExchange(json.data);
                break;

            case 'opponent play':
                opponentMove(json.data);
                break;

            case 'game over':

                break;

        }
    }

    function displayHistory(data) { // entire message history
            // insert every single message to the chat window
            for (var i = 0; i < data.length; i++) {
                    addMessage(data[i].author, data[i].text,
                                        new Date(data[i].time));
            }
    }

    function initUser(data) {
        ui.input.removeAttr('disabled'); // let the user write another message
        ui.chatName.text(myName + ': ');
        ui.status.text(data.length + ' in room.');
        ui.userNames.empty();
        for (var i = data.length - 1; i >= 0; i--) {
            ui.userNames.append($('<li>').text(data[i]));
        };
    } 

    function postNewChat(data) { // it's a single message
        ui.input.removeAttr('disabled'); // let the user write another message
        addMessage(data.author, data.text,
                             new Date(data.time));
    }

    function startGame(data) {
            window.game = state.initState(['You'], [0], 6, 3);
            game.players = data.players;
            game.startIndex = data.startIndex;
            for (var i = game.players.length - 1; i >= 0; i--) {
                if (game.players[i].name === myName) game.player = game.players[i];
            };
            var bound = game.numTypes * 3;
            game.minRow = game.center - bound;
            game.maxRow = game.center + bound;
            game.minCol = game.center - bound;
            game.maxCol = game.center + bound;
            game.columns = game.maxCol - game.minCol + 1;
            game.heldTile;
            game.zoomLevel = 50;
            game.speed = 2;
            board.initGame();

            ui.chat.insertAfter('#zoom-container');
            $('#dialog-container').remove();

            ui.bagCount = $('#bagCount');
            ui.endTurnButton = $('#endTurn');
            ui.resetTurnButton = $('#resetTurn');
    } 

    function turnSuccess(data) {
        var newTiles = data;
        var oldTiles = game.player.tiles;
        var result = game.endTurn();

        // replace client-side new tiles with ones
        // sent from server
        game.player.tiles = oldTiles.concat(newTiles);
        pControls.endTurn(result);
    } 

    function opponentMove(data) {
        var move = data;
        pControls.serverPlay(move);
    }

    function opponentExchange(data) {
        game.initNewTurn();
        pControls.endTurn([ 'exchange', data ])
    }

    function exchangeSuccess(data) {
        var oldTiles = data.oldTiles;
        var newTiles = data.newTiles;
        // for (var i = oldTiles.length - 1; i >= 0; i--) {
        //     game.removeTileFromRack(oldTiles[i]);
        // };
        
        pControls.exchangeTiles(oldTiles, newTiles);
    } 
    /**
     * This method is optional. If the server wasn't able to respond to the
     * in 3 seconds then show some error message to notify the user that
     * something is wrong.
     */
    setInterval(function() {
            if (io.connection.readyState !== 1) {
                    ui.status.text('Error');
                    ui.input.attr('disabled', 'disabled').val('Unable to comminucate '
                                                            + 'with the WebSocket server.');
            }
    }, 3000);

    /**
     * Add message to the chat window
     */
    function addMessage(author, message, dt) {
            ui.content.prepend('<p><span>' + author + '</span> @ ' +
                     + (dt.getHours() < 10 ? '0' + dt.getHours() : dt.getHours()) + ':'
                     + (dt.getMinutes() < 10 ? '0' + dt.getMinutes() : dt.getMinutes())
                     + ': ' + message + '</p>');
    }
});