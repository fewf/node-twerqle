

function setDroppableCells() {
    $( 'div.playable' ).droppable({
        accept: 'img.tile',
        hoverClass: function( event, ui) {
            var row = Number($(this).attr('row'));
            var col = Number($(this).attr('col'));
            var heldTileNum = Number($(game.heldTile).attr('tile'));
            if (game.testTilePlacement(heldTileNum, row, col)) {
                return 'highlight';
            }    
        },
        drop: function( event, ui ) {
            var row = Number($(this).attr('row'));
            var col = Number($(this).attr('col'));
            var heldTileNum = Number($(game.heldTile).attr('tile'));
            if (game.placeTile(heldTileNum, row, col)) {
                board.updateBoardOnMove(game.heldTile, heldTileNum, this);
            }
        },
    });
    $( 'div.playable').click(function() {
        if ($('img.selected').length > 1 || !$('img.selected').length) {
            return false;
        } else {
            var selectedTile = $('img.selected');
            var row = Number($(this).attr('row'));
            var col = Number($(this).attr('col'));
            var selectedTileNum = Number($(selectedTile).attr('tile'));
            if (game.placeTile(selectedTileNum, row, col)) {
                cPlayer.animateTilePlacement(selectedTile, this);
                $(selectedTile).removeClass('selected');
                
            }
        }
    });
}

function setMinMax(row, col) {
    var change = false;
    if (row - game.numTypes < game.minRow) { 
        game.minRow = row - game.numTypes;
        change = true;
        board.makeRow(true);
    }
    if (row + game.numTypes > game.maxRow) {
        game.maxRow = row + game.numTypes;
        change = true;
        board.makeRow()
    }
    if (col - game.numTypes < game.minCol) {
        game.minCol = col - game.numTypes;
        change = true;
        board.makeColumn(true);
    }
    if (col + game.numTypes > game.maxCol) {
        game.maxCol = col + game.numTypes;
        change = true;
        board.makeColumn();
    }
    game.columns = game.maxCol - game.minCol + 1;
    return change;
}



exports.getCellByRowCol = function (row, col) {
    return $('div.cell[row="'+row+'"][col="'+col+'"]');
}
exports.getRowColByCell = function (cell) {
    return [ Number( $(cell).attr('row') ), Number( $(cell).attr('col') ) ];
}














exports.updateBoardOnMove = function (tile, tileNum, snappedTo) {
    var coords = board.getRowColByCell(snappedTo);
    setMinMax(coords[0], coords[1]);
    $(snappedTo).html(board.getColoredShape(tileNum));
    $(tile).remove();
    $('#endTurn').removeAttr('disabled');
    $('#resetTurn').removeAttr('disabled');
    $('#exchangeTiles').attr('disabled', 'disabled');
    $('img.selected').removeClass('selected');
    game.midTurn = true;
    board.updatePlayable();
}

exports.updatePlayable = function() {
    $('.playable').droppable('destroy').removeClass('playable');
    for (var i = game.turnPlayable.length - 1; i >= 0; i--) {
        exports.getCellByRowCol(game.turnPlayable[i][0], game.turnPlayable[i][1]).addClass('playable');
    };
    setDroppableCells();
}




















function makeGridCell (row, col) {
    var ret = '';
    var classes = ['cell'];
    if (col === game.minCol - game.numTypes) classes.push('start');
    if (col === game.maxCol + game.numTypes) classes.push('end');
    if ((row + col) % 2) classes.push('alt');
    if (row === game.center && col === game.center) classes.push('center');
    var cell = $('<div>', {
        'class': classes.join(' '),
        row: row,
        col: col, 
    }).append($(board.getColoredShape(game.board[row][col])))
    return cell;
} 

exports.makeRow = function (prepend, rowNum) {
    var cell;
    if (typeof rowNum === 'undefined') {
        rowNum = prepend ? Number($('#twerqle div.row:first').attr('row')) - 1:
                           Number($('#twerqle div.row:last').attr('row')) + 1;
    }
    var row = $('<div>', {
        'class': 'row',
        id: 'row-' + rowNum,
        row: rowNum
    });
    if (!prepend) {
        $('#twerqle').append(row);
    } else {
        $('#twerqle').prepend(row);
    }
    for (var i = game.minCol; i <= game.maxCol; i++) {
        cell = makeGridCell(rowNum, i);
        row.append($(cell));
    };
    $('#twerqle').css({
        top: '-=' + (game.zoomLevel + 2) * Number(prepend)
    });
}

exports.makeColumn = function(prepend, colNum) {
    if (typeof rowNum === 'undefined') {
        colNum = prepend ? Number($('#twerqle div.row div.cell:first').attr('col')) - 1:
                           Number($('#twerqle div.row div.cell:last').attr('col')) + 1;
    }
    var row;
    for (var i = game.minRow; i <= game.maxRow; i++) {
        row = $('#row-' + i);
        if (!prepend) {
            $(row).append(makeGridCell(i, colNum));
        } else {
            $(row).prepend(makeGridCell(i, colNum));
        }
    }
    $('#twerqle').css({
        width: '+=' + (game.zoomLevel + 1),
        left: '-=' + (game.zoomLevel + 1) * Number(prepend)
    });

}

exports.drawBoard = function (){
    var toAppend, insert, data;
    $('#twerqle').empty();
    var boardWidth = game.columns * (game.zoomLevel + 1);
    var boardHeight = (game.maxRow - game.minRow) * (game.zoomLevel + 1);
    var windowWidth = $(window).width();
    var windowHeight = $(window).height();
    var centerX = (boardWidth - windowWidth)/2;
    var centerY = (boardHeight - windowHeight)/2;
    for(var i = game.minRow; i <= game.maxRow; i++) {
        board.makeRow(false, i);
    };
    $('#twerqle').css({
        width: boardWidth,
        top: -centerY,
        left: -centerX
    });
    $('#twerqle').draggable();
    $('#twerqle').addClass('zoom' + game.zoomLevel);
}





















































exports.initGame = function() {
    board.drawBoard();
    
    pControls.setupInterface();
    board.updatePlayable();
    setDroppableCells();
    pControls.play();
}


exports.getColoredShape = function(tile) {
    if (typeof tile === 'undefined') return '';
    var spacer = 12/game.numTypes,
        color = game.getColor(tile),
        shape = game.getShape(tile),
        colorClass = Math.floor(color * spacer);
    var ret = $('<img>', { 
            src: 'pngs/shape' + shape + '.png',
            'class': 'tile c' + colorClass,
            tile: tile
        });
    return ret;
}

exports.displayResult = function(result) {
    if (result[0] === 'score') {
        var announce = $('<div>', { id: 'announce' }).html(result[1] + 'pts!');
        $('body').append(announce);
        window.setTimeout(function() {
            $(announce).animate({'left': '-=2000px', 'top': '-=2000px'}, 250 * game.speed, function() {
                $(this).remove();
            });
        }, 1000 * game.speed);
    } else if (result[0] === 'game over') {
        var text = 'Game over! Winner(s): '
        for (var i = result[1].length - 1; i >= 0; i--) {
            text = text + result[1][i].name + ' ';
        };
        var text = text + '. Click for new game.'
        var announce = $('<div>', { id: 'announce' }).text(text).click(function() {
            $(this).remove(); 
            $('#twerqle').empty();
            $('#controls').remove();
            $('#player_controls').remove();
            dialog.initDialog();
        });
        $('body').append(announce); 
    } else if (result[0] === 'exchange') {
        var announce = $('<div>', { id: 'announce' }).html('exchanged ' + result[1] + ' tiles');
        $('body').append(announce);
        window.setTimeout(function() {
            $(announce).animate({'left': '-=2000px', 'top': '-=2000px'}, 500 * game.speed, function() {
                $(this).remove();
            });
        }, 1000 * game.speed);        
    }
}