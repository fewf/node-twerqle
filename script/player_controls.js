exports.setupInterface = function() {
    initControls();
    initPlayerTable();
    initZoom();
    initPlayerControls();
    setDraggableTiles();
}

function initControls() {
    var controls = $('<div>', {
        id: 'controls',
    }).mouseenter(function() {
        $(this).css('opacity', 1)
    }).mouseleave(function() {
        $(this).css('opacity', 0.5)
    });
    $(controls).append($('<p>').text('Tiles left in bag: ').append($('<span>', {id: 'bagCount'}).text(game.bag.length)));
    $('body').append($(controls));
}

function initPlayerTable() {
    var playerTable = $('<table>', {id: 'playerTable'});

    playerTable.append(
        $('<tr>').append(
            $('<th>').text('name'))
                 .append(
            $('<th>').text('score'))
                 .append(
            $('<th>').text('tiles'))
        );
    for (var i = 0; i < game.players.length; i++) {
        var carot = (game.getCurrentPlayer() === game.players[i]) ? '> ' : '';
        playerTable.append(
            $('<tr>').append(
                $('<td>', { id: 'name' + i }).text(carot + game.players[i].name))
                     .append(
                $('<td>', { id: 'score' + i }).text(game.players[i].score))
                     .append(
                $('<td>', { id: 'tiles' + i }).text(game.players[i].tiles.length))
            );
    };

    $('#controls').append(playerTable);

}

exports.updatePlayerTable = function() {
    for (var i = 0; i < game.players.length; i++) {
        var carot = (game.getCurrentPlayer() === game.players[i]) ? '> ' : '';
        $('td#name' + i).text(carot + game.players[i].name);
        $('td#score' + i).text(game.players[i].score);
        $('td#tiles' + i).text(game.players[i].tiles.length);
    };
    $('#bagCount').text(game.bag.length)
}

function initZoom() {
    var zoomContainer = $('<div>', { id: 'zoom-container' });
    var zoom = $('<div>', { id: 'zoom' }).slider({
                    orientation: 'vertical',
                    min: 10,
                    max: 80,
                    value: 50,
                    step: 10,
                    slide: function (event, ui) {
                        var oldZoom = game.zoomLevel,
                            newZoom = ui.value;
                            console.log('oldZoom: ' + oldZoom);
                            console.log('newZoom: ' + newZoom);
                        pControls.updateZoom(newZoom, oldZoom);
                    }
    });
    $(zoomContainer).append(zoom).append($('<p>').text('ZOOM'));
    $('#controls').append($(zoomContainer));
}

exports.updateZoom = function (newZoom, oldZoom) {
    game.zoomLevel = newZoom;
    var oldTop = parseInt($('#twerqle').css('top'), 10);
    var oldLeft = parseInt($('#twerqle').css('left'), 10);
    var wh = $(window).height();
    var ww = $(window).width();
    var oldGridPosY = wh/2 - oldTop;
    var oldGridPosX = ww/2 - oldLeft;
    var newGridPosY = oldGridPosX * (newZoom/oldZoom);
    var newGridPosX = oldGridPosY * (newZoom/oldZoom);
    var newTop = wh/2 - newGridPosY;
    var newLeft = ww/2 - newGridPosX;
    var boardWidth = game.columns * (newZoom + 1);
    // var boardHeight = (game.maxRow - game.minRow + 1 * 2) * (newZoom + 2);
$('#twerqle').removeClass('zoom' + oldZoom).addClass('zoom' + newZoom);
    $('#twerqle').css({ 
        width: boardWidth, 
        top: newTop, 
        left: newLeft 
    });
}

exports.sendTurn = function() {
    pControls.disableButtons();
    var actionType = 'end turn';
    var actionData = '';
    for (var i = 0; i < game.turnHistory.length; i++) {
        actionData += 't' + game.turnHistory[i][2] + 'r' + game.turnHistory[i][0] + 'c' + game.turnHistory[i][1];
    };
    sendAction(actionType, actionData);
}

function sendExchange() {
    var actionType = 'exchange';
    var tiles = [ ];
    $('#rack img.selected').each( function () {
        tiles.push($(this).attr('tile'));
    });
    actionData = tiles.join('-');
    sendAction(actionType, actionData);
}

function sendAction(type, data) {
    var msg = type + '>>' + data;
    console.log('send action' + msg);
    io.connection.send(msg);
}

exports.exchangeTiles = function(oldTiles, newTiles) {
    game.getCurrentPlayer().tiles = newTiles;
    var result = [ 'exchange', oldTiles.length ];
    game.initNewTurn();
    pControls.endTurn(result);
}

exports.endTurn = function(result) {
    board.displayResult(result);
    if (result[0] !== 'game over') {
        board.updatePlayable();
        pControls.updatePlayerControls();
        pControls.updatePlayerTable();
        pControls.play();
    } else {
        pControls.updatePlayerTable();
        var toStore = {};
        toStore.players = game.players;
        $.post('update_db.php', toStore, function (data) {
            console.log('ajax success!');
        });
    }
}

function initPlayerControls(player) {
    var playerControls = $('<div>', { id: 'player_controls'});
    var rack = $('<div>', { id: 'rack' }).width(65 * game.numTypes);
    for (var i = 0; i < game.player.tiles.length; i++) {
        var newTile = board.getColoredShape(game.player.tiles[i]);
        $(rack).append($(newTile));
    };
    $(playerControls).width(65 * game.numTypes);
    $(playerControls).append($(rack));
    playerButtons = $('<div>', { id: 'player_buttons' });
    $(playerButtons).append($('<span>', { id: 'player_name' }).text(game.player.name));
    $(playerButtons).append($('<span>', { id: 'player_score' }).text('0'));
    $(playerButtons).append($('<input>', { 
                                           id: 'endTurn',
                                           value: 'end turn'                                
                                         }));
    $(playerButtons).append($('<input>', { 
                                           id: 'resetTurn',
                                           value: 'reset turn' 
                                         }));
    $(playerButtons).append($('<input>', { 
                                           id: 'exchangeTiles',
                                           value: 'exchange tiles' 
                                         }));
    $(playerControls).append($(playerButtons));
    $('body').append($(playerControls));
    $('#rack img.tile').click(clickTile);
    $('input').click(function() {
                routeAction($(this).val());
            }).attr({
                disabled: 'disabled',
                type: 'button'
            });
}

function routeAction(action) {
    pControls.disableButtons();
    switch (action) {
        case 'reset turn':
            resetTurn();
            break;
        case 'end turn':
            pControls.sendTurn();
            break;
        case 'exchange tiles':
            sendExchange();
            break;
    }
}

exports.updatePlayerControls = function() {
    $('#rack').empty();
    $('#player_score').text(String(game.player.score));
    for (var i = 0; i < game.player.tiles.length; i++) {
        var newTile = board.getColoredShape(game.player.tiles[i]);
        $('#rack').append($(newTile));
    };
    $('#rack img.tile').click(clickTile);
}

function setDraggableTiles() {
    $('#rack').sortable({
        revert: 100,
        update: function () {
            // if (game.getCurrentPlayer().tiles === game.numTypes) {
                
            // }
            var tiles = [];
            var rack = $('#rack img.tile');
            for (var i = 0; i < rack.length; i++) {
                tiles.push(Number($(rack[i]).attr('tile')));
            };
            game.player.tiles = tiles;
        },
        start: function(event, ui) {
            game.heldTile = ui.item; 
        },
        stop: function (event, ui) {
            $(ui.item).css({
                height: 50,
                width: 50,
                opacity: 1.0
            }).removeClass('selected');
        },
        over: function (event, ui) {
            $(ui.item).css({
                height: 50,
                width: 50,
                opacity: 1.0
            });
        },
        out: function(event, ui) {
            $(ui.item).css({
                height: game.zoomLevel,
                width: game.zoomLevel,
                opacity: 0.7
            });
        },
    });
    // $('#rack img.tile').click(clickTile);
}

function clickTile() {
    if (game.player === game.getCurrentPlayer()) {
        if (game.midTurn) {
            $('img.selected').removeClass('selected');
            $(this).addClass('selected');
        } else {
            $(this).toggleClass('selected');
            if ($('img.selected').length) {
                $('#exchangeTiles').removeAttr('disabled');
            } else {
                $('#exchangeTiles').attr('disabled', 'disabled');
            }
        }
    }
}



exports.disableButtons = function() {
    $('#controls > input').attr('disabled', 'disabled');
}

function resetTurn(turnHistory) {
    var row, col;
    for (var i = game.turnHistory.length - 1; i >= 0; i--) {
        row = game.turnHistory[i][0];
        col = game.turnHistory[i][1];
        board.getCellByRowCol(row, col).html('');
    };
    game.resetTurn();
    pControls.disableButtons();
    game.midTurn = false;
    board.updatePlayable();
    pControls.updatePlayerControls();
}

exports.getTileByNum = function(num) {
    return $('#rack img.tile[tile="' + num + '"]:first');
}

exports.getTileByRackOrder = function(index) {
    // 1-indexed!
    return $('#rack img.tile:nth-child(' + index + ')');
}

exports.play = function() {
    game.midTurn = false;
    pControls.disableButtons();
    if (game.getCurrentPlayer().type) {
        window.setTimeout(cPlayer.play, 1000 * game.speed, game.getCurrentPlayer().type);
    }
    if (game.player !== game.getCurrentPlayer()) {
        $('div.playable').droppable('disable');
    } else {
        $('div.playable').droppable('enable');
    }
    // $('#rack img.tile').click(clickTile);
}

exports.serverPlay = function(moves) {
        player = game.getCurrentPlayer();
        var oldRack = player.tiles.slice();
        var actions = 0;
    for (var i = 0; i < moves.length; i+=3) {
        actions++;
        var tileNum = Number(moves[i]);
        player.tiles = [ tileNum ];
        var row = Number(moves[i+1]);
        var col = Number(moves[i+2]);
        var cell = board.getCellByRowCol(row, col);
        game.placeTile(tileNum, row, col);
        var tile = cPlayer.makeTile(tileNum, player);
        cPlayer.animateTilePlacement(tile, cell);
    };
    // warning! state is volatile between here and the
    // settimeout function!
    window.setTimeout(function() {
        player.tiles = oldRack.slice(0, actions);
        var result = game.endTurn();
        pControls.endTurn(result);
    }, 250 * game.speed);
}