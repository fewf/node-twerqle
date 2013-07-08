exports.play = function(type) {
    var move = game.computerPlay(type);
    if (move[0] === 'play') {
        var moves = move[1];
        for (var i = 0; i < moves.length; i+=3) {
            var tileNum = Number(moves[i]);
            var row = Number(moves[i+1]);
            var col = Number(moves[i+2]);
            var cell = board.getCellByRowCol(row, col);
            game.placeTile(tileNum, row, col);
            if (game.human) {
                var tile = cPlayer.makeTile(tileNum);
                cPlayer.animateTilePlacement(tile, cell);
            } else {
                $(cell).append(board.getColoredShape(tileNum));
                board.updateBoardOnMove(undefined, tileNum, cell);
            }
        };
        window.setTimeout(function() {
            var result = game.endTurn();
            pControls.endTurn(result);
        }, 250 * game.speed)
    } else {
        $('div.rack img.tile').addClass('selected');
        cPlayer.exchangeTiles();
    }
}

exports.makeTile = function(tileNum, player) {
    var tile = board.getColoredShape(tileNum);
    var otherPlayers = game.players.filter(function(x) {
                            return x.name !== game.player.name; } );
    for (var i = 0; i <= otherPlayers.length; i++) {
        if (game.getCurrentPlayer().name === player.name) break;
    };
    $(tile).addClass('computer'+ (i+1) +'Tile');
    $('body').append($(tile));
    return tile;
}

exports.exchangeTiles = function() {
    var result = game.exchangeTiles(game.getCurrentPlayer().tiles);
    pControls.endTurn(result);
}

exports.animateTilePlacement = function(tile, cell) {
    $(tile).position({my: 'top left', at: 'top left', of: cell, using: function(css, calc) {
        $(this).animate(css, 250 * game.speed, 'linear', function() {
            var heldTileNum = Number($(this).attr('tile'));
            board.updateBoardOnMove(tile, heldTileNum, cell);
        });
    }})
}