var _ = require('underscore');
var qunit = require('qunit');

exports.sum = function(nums) {
    var sum = 0;
    for (var i = nums.length - 1; i >= 0; i--) {
        sum += nums[i]
    };
    return sum;
}

exports.arrayIsSubset = function(array1, array2) {
    if (array1.length > array2.length) return false;
    for (var i = array1.length - 1; i >= 0; i--) {
        if (array2.indexOf(array1[i]) === -1) {
            return false;
        }
    };
    return true;
}

exports.equalCoords = function(coord1, coord2) {
    return coord1[0] === coord2[0] && coord1[1] === coord2[1];
}

exports.coordsIn = function(needle, haystack) {
    for (var i = haystack.length - 1; i >= 0; i--) {
        if (exports.equalCoords(needle, haystack[i])) return i;
    };
    return -1;
}

exports.maxDimension = function(numTypes, copies) {
    // Returns the maximum width or height of the grid
    // given that tiles come in `num_types` colors,
    // `num_types` shapes, and there are `copies` copies
    // of each combination.
    return (numTypes - 1)*numTypes*copies + 1;
}

exports.repeatElements = function(array, times) {
    // Return an array with each element in the input `array` repeated
    // `times` times.
    var out = [];
    for (var i = 0; i < array.length; i++) {
        for (var j = 0; j < times; j++) {
            out.push(array[i]);
        }
    }
    return out;
}

exports.maxTypes = 12;

exports.initState = function(playerNames, playerTypes, numTypes, numCopies) {
    var state = {};
    if (exports.maxTypes < numTypes) throw 'Too Many Types';
    state.numTypes = Number(numTypes);       // 6 colors, 6 shapes
    state.copies = Number(numCopies);         // 3 copies of each color+shape combo
    state.tilesPerPlayer = Number(numTypes); // players hold 6 tiles at a time
    var boardSize = exports.maxDimension(state.numTypes, state.copies)*2 - 1;
    state.board = new Array(boardSize);
    for (var i = 0; i < boardSize; i++)
        state.board[i] = new Array(boardSize);
    state.center = (boardSize + 1) / 2;  // internal x, y of first placed tile

    state.bag = _.shuffle(exports.repeatElements(_.range(0,
                                            state.numTypes*state.numTypes),
                                         state.copies));

    var players = [];
    for (var i = 0; i < playerNames.length; i++) {


        players.push({
            name: playerNames[i],
            type: playerTypes[i],
            score: 0,
            tiles: _.take(state.bag, state.tilesPerPlayer),
        });

        // remove the tiles the player took from the 'bag'
        state.bag = _.drop(state.bag, state.tilesPerPlayer);
    }
    state.players = players;
    state.turn = 0;
    state.gameHistory = [];
    state.turnHistory = [];
    state.turnOrientation = -1;
    // state.occupiedCoords = [];
    state.playable = [ [state.center, state.center] ];
    state.turnPlayable = [ [state.center, state.center] ];
    state.playableCache = [ [state.center, state.center] ];

    state.getShape = function(num) {
        return num % this.numTypes;
    }

    state.getColor = function(num) {
        return Math.floor(num/this.numTypes);
    }

    state.getAllLinesInRack = function(tiles) {
        // takes list of tile values, returns longest line 
        var outer = this;
        var lines = [];
        tiles = _.uniq(tiles);
 
        for (i=0; i < this.numTypes; i++) {
            lines.push(tiles.filter(
                function (x) {
                    return outer.getShape(x) === i; }));
            lines.push(tiles.filter(
                function (x) {
                    return outer.getColor(x) === i; }));
        }
        lines = lines.filter(function (x) {
                    return x.length } );

        return lines;
    }
    state.getLongestLine = function(tiles) {
        var lines = this.getAllLinesInRack(tiles);

        var linesLengths = lines.map(function (x) {
                            return x.length; });

        var maxLine = Math.max.apply(Math, linesLengths);

        return lines[linesLengths.indexOf(maxLine)];
    }

    state.getStartIndex = function() {
        var outer = this;
        var longestLineLengths = this.players.map(
                                    function (x) {
                                        return outer.getLongestLine(x.tiles).length;
                                    });

        this.startIndex = longestLineLengths.indexOf(Math.max.apply(Math, longestLineLengths));        
    }

    state.getStartIndex();

    state.getCurrentPlayer = function() {
        return this.players[(this.turn + this.startIndex) % this.players.length]
    }

    state.getColLine = function(row, col, coords) {
        // if optional coords set to true, will return
        // array of surrounding empty coords
        var minRow = row;
        var maxRow = row;
        if (this.board[row][col] === undefined) return [];
        var colLine = [];
        for (var i = 0; this.board[row - i][col] !== undefined; i++) {
            colLine.unshift(this.board[row-i][col]);
            minRow = row - i;
        };
        for (var i = 1; this.board[row + i][col] !== undefined; i++) {
            colLine.push(this.board[row + i][col]);
            maxRow = row + i;
        };
        if (coords) {
            return [ [minRow - 1, col], [maxRow + 1, col] ];
        }
        return colLine;        
    }

    state.getRowLine = function(row, col, coords) {
        // if optional coords set to true, will return
        // array of surrounding empty coords
        var minCol = col;
        var maxCol = col;
        if (this.board[row][col] === undefined) return [];
        var rowLine = [];
        for (var i = 0; this.board[row][col - i] !== undefined; i++) {
            rowLine.unshift(this.board[row][col-i]);
            minCol = col - i;
        };
        for (var i = 1; this.board[row][col + i] !== undefined; i++) {
            rowLine.push(this.board[row][col + i]);
            maxCol = col + i;
        };
        if (coords) {
            return [ [row, minCol - 1], [row, maxCol + 1] ];
        }
        return rowLine;
    }

    state.getLines = function(row, col, coords) {
        if (coords) {
            var ret = this.getRowLine(row, col, coords);
            ret = ret.concat(this.getColLine(row, col, coords));
            return ret;
        }
        return [this.getRowLine(row, col, coords), this.getColLine(row, col, coords)];
    }

    state.lineIsValid = function(line) {
        var outer = this;
        // not over numTypes
        if (line.length > this.numTypes) return false;

        // no duplicates
        if (_.uniq(line).length !== line.length) return false;

        // all 1-length lines valid
        if (line.length === 1) return true;

        var shapes = line.map(function(x) {
                                    return outer.getShape(x); });
        var colors = line.map(function(x) {
                                    return outer.getColor(x); });

        return _.uniq(colors).length === 1 || _.uniq(shapes).length === 1;
    }

    state.getTurnPlayable = function() {
        var th = this.turnHistory;
        var allPlayable = this.playable;
        if (!th.length) return allPlayable;
        var turnPlayable = [];
        var row = th[0][0];
        var col = th[0][1];
        if (th.length === 1) {
            var row = th[0][0];
            var col = th[0][1];

            var turnPlayable = this.getLines(row, col, true);
            return turnPlayable;
        } else if (this.turnOrientation === 1) {
            var turnPlayable = this.getRowLine(row, col, true);
        } else if (this.turnOrientation === 2) {
            var turnPlayable = this.getColLine(row, col, true);
        }

        return turnPlayable;
    }

    state.updateTurnPlayable = function() {
        this.turnPlayable = this.getTurnPlayable();
    }

    state.updatePlayable = function(row, col) {
        if (this.boardIsEmpty()) {
            this.playable = [ [this.center, this.center] ];
        } else {
            var outer = this;
            // remove just played coords from playable
            this.playable = this.playable.filter( function (x) {
                    return !exports.equalCoords(x, [row, col]);
                })
            // var coordIndex = this.playable.indexOf([row, col]);
            // this.playable.splice(coordIndex, 1);
            var playableNeighbors = this.getPlayableNeighbors(row, col);
            for (var i = playableNeighbors[1].length - 1; i >= 0; i--) {
                var index = exports.coordsIn(playableNeighbors[1][i], this.playable);
                if (index !== -1) {
                    this.playable.splice(index, 1);
                }
            };
            this.playable = this.playable.concat(playableNeighbors[0]);
        }
        this.updateTurnPlayable();
    }

    state.coordsArePlayable = function(row, col) {
        for (var i = this.playable.length - 1; i >= 0; i--) {
            if (exports.equalCoords(this.playable[i], [row, col])) {
                return true;
            }
        };
        return false;
    }

    state.getCoordNeighbors = function(row, col) {
        var boardSize = exports.maxDimension(this.numTypes, this.copies)*2 - 1;
        var neighbors =     [
                                [row + 1, col], [row - 1, col], 
                                [row, col + 1], [row, col - 1]
                            ];
        return neighbors.filter( function(x) {
                return x[0] > 0 && x[0] < boardSize &&
                            x[1] > 0 && x[1] < boardSize;
            ;})
    }

    state.getPlayableNeighbors = function(row, col) {
        var playableNeighbors = [];
        var unplayableNeighbors = [];
        var outer = this;
        // var neighbors = this.getCoordNeighbors(row, col);
        var neighbors = this.getLines(row, col, true);
        for (var i = neighbors.length - 1; i >= 0; i--) {
            if (this.coordsPlayable(neighbors[i][0], neighbors[i][1])) {
                playableNeighbors.push(neighbors[i]);
            } else {
                unplayableNeighbors.push(neighbors[i]);
            }
        };

        playableNeighbors = playableNeighbors.filter(
                                        function (x) {
                                            return exports.coordsIn(x, outer.playable) === -1;
                                        });
        return [ playableNeighbors, unplayableNeighbors ];
    }

    state.getAllPlayable = function() {
        if (this.boardIsEmpty()) {
            var uhwhat;
            return [ [this.center, this.center] ];
        }
        var checkCoords = []; // coords we've already checked
        var playableNeighbors = [];
        var outer = this;

        function recurse(coords) {
            if (exports.coordsIn(coords, checkCoords) !== -1) {
                return [];
            }
            
            checkCoords.push(coords);
            var neighbors = outer.getCoordNeighbors(coords[0], coords[1]);
            for (var i = neighbors.length - 1; i >= 0; i--) {
                if (!outer.tileAt(neighbors[i][0], neighbors[i][1])) {
                    if (exports.coordsIn(neighbors[i], playableNeighbors) === -1) {
                        playableNeighbors.push(neighbors[i]);
                    }
                } else {
                    // XXX may overflow stack if enough tiles down.
                    playableNeighbors.concat(recurse(neighbors[i]));
                }
            };
        }
        
        recurse([this.center, this.center]);

        return playableNeighbors;
    }

    state.hasNeighbor = function(row, col) {
        var neighbors = this.getCoordNeighbors(row, col);
        for (var i = neighbors.length - 1; i >= 0; i--) {
            if (this.tileAt(neighbors[i][0], neighbors[i][1])) return true;
        };
    }

    state.tileAt = function(row,col) {
        return this.board[row][col] !== undefined;
    }

    state.confirmTurnIsLine = function() {
        // SIDE-EFFECT: sets state.turnOrientation
        // 0: ambiguous
        // 1: row
        // 2: col
        if (this.turnHistory.length < 2) {
            this.turnOrientation = 0;
            return true;
        }

        var rows = this.turnHistory.map(function(x) {
                                            return x[0]; });
        var cols = this.turnHistory.map(function(x) {
                                            return x[1]; });

        if (_.uniq(rows).length === 1) {
            // is row line - check no gaps
            var row = rows[0];
            var minCol = Math.min.apply(Math, cols);
            var maxCol = Math.max.apply(Math, cols);
            var slice = this.board[row].slice(minCol, maxCol + 1);
        } else if (_.uniq(cols).length === 1) {
            // is col line - check no gaps
            var col = cols[0];
            var minRow = Math.min.apply(Math, rows);
            var maxRow = Math.max.apply(Math, rows);
            var slice = this.columnSlice(col, minRow, maxRow + 1);
        } else {    
            return false;
        }

        if (slice.indexOf(undefined) === -1) {
            this.turnOrientation = (typeof row !== 'undefined') ? 1 : 2;
            return true;
        } else {
            return false;
        }
    }
    
    state.columnSlice = function(col, minRow, maxRow) {
        var colSlice = [];
        for (var i = minRow; i < maxRow; i++) {
            colSlice.push(this.board[i][col])
        };
        return colSlice;
    }
    

    state.playerHasTile = function(tile, rack) {
        rack = (typeof rack === 'undefined') ? 
                this.getCurrentPlayer().tiles : rack;
        return rack.indexOf(tile) !== -1;
    }

    state.playerHasTiles = function(tiles) {
        var rack = this.getCurrentPlayer().tiles.slice(0);
        for (var i = tiles.length - 1; i >= 0; i--) {
            if (!this.playerHasTile(tiles[i], rack)) return false;
            rack = this.removeTileFromRack(tiles[i], rack);
        };
        return true;
    }

    state.updateState = function(tile, row, col) {
        this.removeTileFromRack(tile);
        this.board[row][col] = tile;
        this.turnHistory.push([row, col, tile]);
        // this.occupiedCoords.push([row, col]);
    }

    state.rewindState = function(tile, row, col) {
        this.getCurrentPlayer().tiles.push(Number(tile));
        this.board[row][col] = undefined;
        this.turnHistory.pop();
        // this.occupiedCoords.pop();
        if (!this.turnHistory.length) this.playable = this.playableCache;
        this.updateTurnPlayable();
    }

    state.removeTileFromRack = function(tile, rack) {
        rack = (typeof rack === 'undefined') ? 
                this.getCurrentPlayer().tiles : rack;
        rack.splice(rack.indexOf(tile), 1);
        return rack;
    }


    state.scoreLine = function(line) {
        if (line.length === 1) return 0;
        if (line.length === this.numTypes) {
            return this.numTypes * 2;
        }
        return line.length;
    }

    state.scoreTurn = function() {
        var outer = this;
        var th = this.turnHistory;
        var score = 0;

        if (!th.length) return score;
        // Special handling for case where first move is just one tile:
        if (!this.turn && this.turnHistory.length === 1) return 1;

        if (th.length === 1) {
            var lines = this.getLines(th[0][0], th[0][1]);
            score += this.scoreLine(lines[0]);
            score += this.scoreLine(lines[1]);
        } else {
            if (this.turnOrientation === 1) {
                // mainline is row
                var mainLine = this.getRowLine(th[0][0], th[0][1])
                score += this.scoreLine(mainLine);
                var subscores = th.map(function (x) {
                        return outer.scoreLine(outer.getColLine(x[0], x[1]));
                    });
                score += exports.sum(subscores);
            } else {
                // mainline is col
                var mainLine = this.getColLine(th[0][0], th[0][1])
                score += this.scoreLine(mainLine);
                var subscores = th.map(function (x) {
                        return outer.scoreLine(outer.getRowLine(x[0], x[1]))
                    });
                score += exports.sum(subscores);
            }
        }

        // End of game bonus:
        if (!this.bag.length && !this.getCurrentPlayer().tiles.length) score += this.numTypes;

        return score;
    }

    state.resetTurn = function () {
        var th = this.turnHistory;
        var player = this.getCurrentPlayer();
        for (var i = th.length - 1; i >= 0; i--) {
            player.tiles.push(Number(this.board[th[i][0]][th[i][1]]));
            this.board[th[i][0]][th[i][1]] = undefined;
            // this.occupiedCoords.pop();
        };
        this.turnHistory = [];
        this.turnOrientation = -1;
        this.playable = this.playableCache;
        this.updateTurnPlayable();
    }

    state.replenishTiles = function(howMany) {
        var player = this.getCurrentPlayer();
        howMany = (this.bag.length < howMany) ? this.bag.length : howMany;
        var newTiles = _.take(this.bag, howMany);
        player.tiles = player.tiles.concat(newTiles);
        this.bag = _.drop(this.bag, howMany);
        return newTiles;
    } 

    state.placeTile = function(tile, row, col) {
        // var ret = this.placeTileValidate(tile, row, col);
        if (!this.placeTileValidate(tile, row, col)) {
            this.rewindState(tile, row, col);
            return false;
        } else {
            this.updatePlayable(row, col);
            return true;
        }
    }

    state.testTilePlacement = function(tile, row, col) {
        var ret = this.placeTileValidate(tile, row, col);
        this.rewindState(tile, row, col);
        return ret;
    }

    state.placeTileValidate = function(tile, row, col) {

        if (this.boardIsEmpty()) {
            // Special handling for first tile placed in game
            row = this.center;
            col = this.center;
        } else if (!this.hasNeighbor(row, col)) {
            // Normal handling.
            console.log('has no neighbor');
            return false;
        }

        // Tile placement validation
        if (this.tileAt(row, col)) {console.log('tile already there'); return false;}
        if (!this.playerHasTile(tile)) {console.log('player dont got tile'); return false;}
        
        // Update state
        this.updateState(tile, row, col);

        // Line validation
        if (this.confirmTurnIsLine()) {
            // Newly made ines are either all same shape or color
            var newLines = this.getLines(row, col);
            if (this.lineIsValid(newLines[0]) && this.lineIsValid(newLines[1])) {
                // Success!
                return true; 
            } else {
                // Reverse tile placement
                // this.rewindState(tile, row, col);
                console.log('line aint valid');
                return false;
            }
        } else {
            // Reverse tile placement
            // this.rewindState(tile, row, col);
            console.log('turn aint line');
            return false;
        }
    }

    state.determineWinner = function() {
        var winningScore = -1;
        for (var i = this.players.length - 1; i >= 0; i--) {
            if (this.players[i].score > winningScore) {
                winners = [this.players[i]];
                winningScore = this.players[i].score;
            } else if (this.players[i].score === winningScore) {
                winners.push(this.players[i]);
            }
        };
        return winners;
    }

    state.endTurn = function() {
        if (!this.turnHistory.length) return false;

        var player = this.getCurrentPlayer();
        var turnScore = this.scoreTurn();
        player.score += turnScore;
        var newTiles = this.replenishTiles(this.turnHistory.length);
        if (!player.tiles.length) {
            var winners = this.determineWinner();
            return ['game over', winners];
        } else {
            this.initNewTurn();
            return ['score', turnScore, newTiles];
        }
    }

    state.initNewTurn = function() {
        this.gameHistory = this.gameHistory.concat(this.turnHistory);
        this.turnHistory = [];
        this.turn++;
        this.updateTurnPlayable();
        this.playableCache = this.playable;
        // if (this.getCurrentPlayer().type > 1) this.computerPlay();
    }

    state.boardIsEmpty = function() {
        var firstTurn = Boolean(!this.turn);
        var noHistory = Boolean(!this.turnHistory.length);
        var test = (firstTurn && noHistory);
        return test;
    }

    state.exchangeTiles = function(tiles) {
        if (this.turnHistory.length) return false;
        if (tiles.length > this.bag.length) return false;
        if (!this.playerHasTiles(tiles)) return false;
        var newTiles = this.replenishTiles(tiles.length);
        this.returnTiles(tiles);
        this.bag = _.shuffle(this.bag);
        this.initNewTurn();
        return [ 'exchange', newTiles ];
    }

    state.returnTiles = function(tiles) {
        if (!tiles.length || tiles.length > this.bag.length) return false;
        for (var i = tiles.length - 1; i >= 0; i--) {
            this.removeTileFromRack(tiles[i]);
            this.bag.push(tiles[i]);
        };
        this.bag = _.shuffle(this.bag);
    }

    state.coordsPlayable = function(row, col) {
        // FINISH ME!
        if (this.tileAt(row, col)) return false;

        var upLine = this.getColLine(row - 1, col);
        var rightLine = this.getRowLine(row, col + 1);
        var downLine = this.getColLine(row + 1, col);
        var leftLine = this.getRowLine(row, col - 1);

        //length test
        if (upLine.length + downLine.length >= this.numTypes ||
            leftLine.length + rightLine.length >= this.numTypes)
            return false;

        // test opposite lines can connect
        if (!this.linesCanConnect(upLine, downLine) ||
            !this.linesCanConnect(leftLine, rightLine)) return false;

        // test perpendicular lines can hinge
        return (this.linesCanHinge(upLine, rightLine) &&
                this.linesCanHinge(upLine, leftLine) &&
                this.linesCanHinge(downLine, rightLine) &&
                this.linesCanHinge(downLine, leftLine));
    }

    state.lineHasShape = function(line, shape) {
        for (var i = line.length - 1; i >= 0; i--) {
            if (this.getShape(line[i]) === shape) return true;
        };
        return false;
    }

    state.lineHasColor = function(line, color) {
        for (var i = line.length - 1; i >= 0; i--) {
            if (this.getColor(line[i]) === color) return true;
        };
        return false;
    }

    state.linesCanHinge = function(line1, line2) {

        // one or more is blank or both lines are one-length (ambiguous line type)
        if ((!line1.length || !line2.length) ||
            (line1.length === 1 && line2.length === 1)) return true;

        var line1Type = this.getLineType(line1);
        var line2Type = this.getLineType(line2);


        // If one line is just one tile, lines fail
        // if that tile is not of the color|shape of the longer line
        // AND the longer line has the color|shape 
        if (line1.length === 1 || line2.length === 1) {
            // determine which is longer/one-tile
            if (line1.length === 1) {
                var testTypes = line1Type;
                var testTile = line1[0];
                var longerLineType = line2Type[0];
                var longerLine = line2;
            } else if (line2.length === 1) {
                var testTile = line2[0];
                var longerLineType = line1Type[0];
                var longerLine = line1;
                var testTypes = line2Type;
            }

            if (testTypes.indexOf(longerLineType) !== -1) return true;
            if (longerLineType < this.numTypes &&
                this.getColor(testTile) !== longerLineType &&
                this.lineHasShape(longerLine, testTypes[1] - this.numTypes)) {
                return false;
            } else if (longerLineType >= this.numTypes &&
                this.getShape(testTile) !== longerLineType &&
                this.lineHasColor(longerLine, testTypes[0])) {
                return false;            
            }
            return true;
        }

        // two >1-length lines

        line1Type = line1Type[0];
        line2Type = line2Type[0];

        // If same type of lines, its not hinge-able if
        // among the two are already all the kinds of that
        // line
        if (line1Type === line2Type) {
            return (_.union(line1, line2).length <= this.numTypes)
        }

        var line1IsColor = line1Type < this.numTypes
        var line2IsColor = line2Type < this.numTypes
        // var line1IsShape = line1Type >= this.numTypes
        // var line2IsShape = line2Type >= this.numTypes

        // Nothing doing if they are different color lines, or different
        // shape lines. btw, Number(true) === 1.
        if (Number(line1IsColor) + Number(line2IsColor) !== 1)
            return false;

        // Finally, if one is shape, and the other is color, it's only
        // going to work if the color|shape is already represented.
        var getShape = this.getShape;
        var getColor = this.getColor;
        if (line1IsColor) {
            if (line1.filter(function(x) {
                    return getShape(x) === line2Type - this.numTypes}
                ).length) return false;
            if (line2.filter(function(x) {
                    return getColor(x) === line1Type}
                ).length) return false;
        } else {
            if (line2.filter(function(x) {
                    return getShape(x) === line1Type - this.numTypes}
                ).length) return false;
            if (line1.filter(function(x) {
                    return getColor(x) === line2Type}
                ).length) return false;
        }

        return true;
    }

    state.linesCanConnect = function(line1, line2) {
        // test duplicates first
        if (_.intersection(line1, line2).length) return false;

        var line1Type = this.getLineType(line1);
        var line2Type = this.getLineType(line2);
        var intersection = _.intersection(line1Type, line2Type);
        return Boolean(intersection.length);
    }

    state.getLineType = function(line) {
        if (!line.length) return _.range(this.numTypes * 2);

        var testTile = line[0];
        var testColor = this.getColor(testTile);
        var testShape = this.getShape(testTile) + this.numTypes;

        if (line.length === 1) 
            return [ testColor, testShape ];

        if (this.getColor(line[1]) === testColor) return [ testColor ];
        else return [ testShape ];

    }

    state.computerPlay = function(type) {
        var outer = this;
        var rack = this.getCurrentPlayer().tiles.slice(0);

        // Reduce possible lines in rack to only those which
        // are not subsets of others.
        var lines = this.getAllLinesInRack(rack);
        var linesCopy = lines.slice(0);
        var newLines = [];
        var len = lines.length;
        for (var i = len - 1; i >= 0; i--) {
            var tester = lines.pop();
            var notSubset = true;
            for (var j = lines.length - 1; j >= 0; j--) {
                if (exports.arrayIsSubset(tester, lines[j])) {
                    notSubset = false;
                }
            };
            if (notSubset) newLines.push(tester);
        };

        if (this.boardIsEmpty()) type = 10;
        var scores = {};

        function recurse_optimize_score(string, lastMove) {
            var playables = outer.turnPlayable;
            var playablesLength = outer.turnPlayable.length;
            for (var i = 0; i < outer.turnPlayable.length; i++) {
                var rack = outer.getCurrentPlayer().tiles;
                for (var j = rack.length - 1; j >= 0; j--) {
                    var tile = outer.getCurrentPlayer().tiles[j];
                    var row = Number(outer.turnPlayable[i][0]);
                    var col = Number(outer.turnPlayable[i][1]);
                    if (outer.placeTile(tile, row, col)) {
                        var newLastMove = 't' + tile + 'r' + row + 'c' + col;
                        recurse_optimize_score(string + newLastMove, newLastMove);
                    }
                };
            };
            if (string) {
                var lastMove = lastMove.split(/[trc]/);
                scores[string] = outer.scoreTurn();
                outer.rewindState(Number(lastMove[1]), Number(lastMove[2]), Number(lastMove[3]));
            }
        }

        function recurse_avoid_qwerlebait(string, lastMove) {
            var rack, tile, row, col, lines, newLastMove;
            for (var i = 0; i < outer.turnPlayable.length; i++) {
                // if (string || playableRange.indexOf(i) !== -1) {
                    var rack = outer.getCurrentPlayer().tiles;
                    for (var j = rack.length - 1; j >= 0; j--) {
                        var tile = outer.getCurrentPlayer().tiles[j];
                        var row = Number(outer.turnPlayable[i][0]);
                        var col = Number(outer.turnPlayable[i][1]);
                        if (Math.random() < type * ( 0.5 * ( 1 / outer.turnHistory.length + 1 ) )) {
                            if (outer.placeTile(tile, row, col)) {
                                var newLastMove = 't' + tile + 'r' + row + 'c' + col;
                                recurse_avoid_qwerlebait(string + newLastMove, newLastMove);
                            }
                        }
                    };
                // }
            };
            if (string) {
                var lines = [];
                var colLine, rowLine, skip;
                var lastMove = lastMove.split(/[trc]/);
                var row = Number(lastMove[2]);
                var col = Number(lastMove[3]);
                var skip = false;


                if (outer.turnOrientation === 0) {
                    rowLine = outer.getRowLine(row, col);
                    if (rowLine.length === outer.numTypes - 1)
                        lines = lines.concat(outer.getRowLine(row, col, true));
                    colLine = outer.getColLine(row, col);
                    if (colLine.length === outer.numTypes - 1)
                        lines = lines.concat(outer.getColLine(row, col, true));
                } else if (outer.turnOrientation === 1) {
                    rowLine = outer.getRowLine(row, col);
                    if (rowLine.length === outer.numTypes - 1) 
                        lines = lines.concat(outer.getRowLine(row, col, true));
                    for (var i = 0; i < outer.turnHistory.length; i++) {
                        colLine = outer.getColLine(     outer.turnHistory[i][0],
                                                        outer.turnHistory[i][1]
                                                    );
                        if (colLine.length === outer.numTypes - 1) 
                            lines = lines.concat(   outer.getColLine(outer.turnHistory[i][0],
                                                    outer.turnHistory[i][1], true)
                                                );
                    };
                } else if (outer.turnOrientation === 2) {
                    colLine = outer.getColLine(row, col);
                    if (colLine.length === outer.numTypes - 1) lines = lines.concat(outer.getColLine(row, col, true));
                    for (var i = 0; i < outer.turnHistory.length; i++) {
                        rowLine = outer.getRowLine(outer.turnHistory[i][0], outer.turnHistory[i][1]);
                        if (rowLine.length === outer.numTypes - 1) lines = lines.concat(outer.getRowLine(outer.turnHistory[i][0], outer.turnHistory[i][1], true));
                    };
                }
                for (var i = 0; i < lines.length; i++) {
                    if (outer.coordsPlayable(lines[i][0], lines[i][1])) skip = true;
                };
                // if (!skip) {
                    scores[string] = outer.scoreTurn() - (Math.floor(outer.numTypes/2) * Number(skip));
                // }
                outer.rewindState(Number(lastMove[1]), Number(lastMove[2]), Number(lastMove[3]));
                // ui.getCellByRowCol(lastMove[2], lastMove[3]).html('');
            }
            // string = string.slice(0, string.lastIndexOf('t'));
        }

        for (var i = newLines.length - 1; i >= 0; i--) {
            this.getCurrentPlayer().tiles = newLines[i];
            // if (type === 2) {
            //     recurse_optimize_score('','');
            // } else {
                recurse_avoid_qwerlebait('','');
            // }
            this.resetTurn();
        };
        this.getCurrentPlayer().tiles = rack;

        var highest = 0; 
        var options; 
        for (move in scores) {
            if (scores[move] > highest) {
                highest = scores[move];
                options = [move];
            } else if (scores[move] === highest) {
                options.push(move);
            }
        }

        if (highest) {
            var index = Math.floor(Math.random() * options.length);
            var moves = options[index].split(/[trc]/);
            moves.shift();
            return ['play', moves];
            // for (var i = 0; i < moves.length; i+=3) {
            //     var tile = Number(moves[i]);
            //     var row = Number(moves[i+1]);
            //     var col = Number(moves[i+2]);
            //     this.placeTile(tile, row, col)                
            // };
            // this.endTurn();
        } else {
            return ['exchange'];
        }
    }

    return state;
} 