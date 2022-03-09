var socket = io("/game")
var match_info = null;
var match_id = null;
var is_room_full = false;
var my_turn = null;

var nMoves = 0;
var board = null;
var game = new Chess();
var whiteSquareGrey = '#a9a9a9';
var blackSquareGrey = '#696969';

var is_roll = false;
var randomPiece = null;

var $myBoard = $('#myBoard');
var $status = $('#status');
var $fen = $('#fen');
var $pgn = $('#pgn');
var $gameDetails = $('#gameDetails');
var $gacha = $('#gacha');
var $rolledPiece = $('#rolledPiece');

// Actual game variables
var white_points = 10;
var black_points = 10;
var weighted_probability = [
  ['n', 18],
  ['b', 18],
  ['r', 8],
  ['q', 4]
];
var piecePoints = {
  'p': 1,
  'cp': 1,
  'n': 3,
  'b': 3,
  'r': 5,
  'q': 9,
  'k': Infinity
};
var chessPieces = {
  'n': game.KNIGHT,
  'b': game.BISHOP,
  'r': game.ROOK,
  'q': game.QUEEN
}

socket.on('connect', () => {

  socket.emit("get game");

});

socket.on('redirect', (destination) => {
    window.location.href = destination;
});

socket.on("get game", (match_info, your_turn) => {
  match_id = match_info.id;
  my_turn = your_turn;

  if(match_info.black_player){
    socket.emit("start game");
  } else{    
    $myBoard.html(`
    <center>
        <h4> Waitting for another player... </h4>
    </center>
    `);
  }
});

socket.on("start game", (match_info, your_turn) => {
  if(match_id == null) return;


  if(match_id != match_info.id) return;

  white_points = match_info.white_points;
  black_points = match_info.black_points;
  $gameDetails.html("Black's point: " + black_points + "<br>White's point: " + white_points);

  is_room_full = true;
  let config = {
    draggable: true,
    position: match_info.fen,
    onDragStart: onDragStart,
    onDrop: onDrop,
    onMouseoutSquare: onMouseoutSquare,
    onMouseoverSquare: onMouseoverSquare,
    onSnapEnd: onSnapEnd
  }
  board = Chessboard('myBoard', config)
  game.load(match_info.fen);
  if(my_turn === 'b'){
    board.flip();
  }
  updateStatus(null, false);
})

socket.on("move", (matchid, match_info) => {
  if(match_id != matchid) return;
  // console.log("move")
  game.load(match_info.fen);
  board.position(match_info.fen);
  updateStatus(null, false);
});

socket.on("point changed", (matchid, changed_player, new_point) => {
  if(match_id != matchid) return;
  // console.log("Black's point: " + black_points + "<br>White's point: " + white_points)
  // console.log(matchid, changed_player, new_point);
  if(changed_player == 'w') white_points = new_point;
  else black_points = new_point;

  // console.log("Black's point: " + black_points + "<br>White's point: " + white_points)
  // console.log()

  $gameDetails.html("Black's point: " + black_points + "<br>White's point: " + white_points);
});

socket.on("gacha", (matchid, rolledPiece, match_info) => {
  if(match_id != matchid) return;

  randomPiece = rolledPiece;

  var status = "You rolled a ";
  if(rolledPiece == game.KNIGHT){
    status += "Knight!\nSelect a pawn to replace.";
  } else if(rolledPiece == game.BISHOP){
    status += "Bishop!\nSelect a pawn to replace.";
  } else if(rolledPiece == game.ROOK){
    status += "Rook!\nSelect a pawn to replace.";
  } else{
    status += "Queen!!!\nSelect a pawn to replace.";
  }
  
  $rolledPiece.html(status)
  is_roll = true;
  // $gameDetails.html("Black's point: " + black_points + "<br>White's point: " + white_points);
})

socket.on("changed piece", (matchid, match_info) => {
  if(match_id != matchid) return;
  // console.log("Changed Piece:")
  // console.log(match_info.fen);
  // console.log(game.fen());
  game.load(match_info.fen);
  // console.log(game.fen());
  board.position(match_info.fen);
  randomPiece = null;
  updateStatus(null, false);
})


socket.on("game finished", (matchid, result) => {
  if(match_id != matchid) return;

  if(result === 3){
    $status.html('Game over, drawn position')
  } else if(result === 2){
    if(my_turn === 'b') $status.html('Game over, you won')
    else $status.html('Game over, you lost')
  } else if(result === 1){
    if(my_turn === 'b') $status.html('Game over, you lost')
    else $status.html('Game over, you won')
  }

  $gacha.attr('disabled', true)
});


function chooseRandom(){
  var total = 48;
  const threshold = Math.random() * total;
  total = 0;
  var n = weighted_probability.length;
  for(let i = 0;  i < n; i++){
    total += weighted_probability[i][1];
    if(total >= threshold){
      return weighted_probability[i][0];
    }
  }
  return weighted_probability[n - 1][0];
}

function rollRandomPiece(){

  socket.emit("gacha", match_id, my_turn);

  // randomPiece = chessPieces[chooseRandom()];

  // if(my_turn === game.turn()){
  //   socket.emit("point changed", match_id, game.turn(), -10);

  // var status = "You rolled a ";
  // if(randomPiece == game.KNIGHT){
  //   status += "Knight!\nSelect a pawn to replace.";
  // } else if(randomPiece == game.BISHOP){
  //   status += "Bishop!\nSelect a pawn to replace.";
  // } else if(randomPiece == game.ROOK){
  //   status += "Rook!\nSelect a pawn to replace.";
  // } else{
  //   status += "Queen!!!\nSelect a pawn to replace.";
  // }

  // for(var invalidPawn = true; invalidPawn;){
  //   $rolledPiece.html(status)
  //   is_roll = true;
  //   invalidPawn = false;
  // }

  // $gameDetails.html("Black's point: " + black_points + "<br>White's point: " + white_points);
}


function removeGreySquares () {
  $('#myBoard .square-55d63').css('background', '')
}

function greySquare (square) {
  var $square = $('#myBoard .square-' + square)

  var background = whiteSquareGrey
  if ($square.hasClass('black-3c85d')) {
    background = blackSquareGrey
  }

  $square.css('background', background)
}

function onDragStart (source, piece) {
  // do not pick up pieces if the game is over
  if (game.game_over() || !is_room_full) return false

  // or if it's not that side's turn
  if ((game.turn() === 'w' && piece.search(/^b/) !== -1) ||
      (game.turn() === 'b' && piece.search(/^w/) !== -1) ||
      game.turn() != my_turn) {
    return false
  }

  // console.log(game.fen());

  if(is_roll){
    var piece = game.get(source);
    let txt = "";
    if(piece === null){
      txt += "There is no piece on that square!\nPlease select again.";
    } else if(piece['type'] != 'p'){
      txt += "That is not a pawn!\nPlease select again.";
    } else if(piece['color'] != game.turn()){
      txt += "That is not your pawn!\nPlease select again.";
    } else{
      // game.put( {type: randomPiece, color: my_turn }, source);
      // console.log(randomPiece);
      socket.emit("changed piece", match_id, my_turn, {type: randomPiece, color: my_turn }, source);
      // game.load(game.fen());
      // board.position(game.fen());
      is_roll = false;
      $rolledPiece.html("")
    }
  }

}

function onDrop (source, target) {
  removeGreySquares()


  var move_info = {
    from: source,
    to: target,
    promotion: 'q' // NOTE: always promote to a queen for example simplicity
  }

  // see if the move is legal
  var move = game.move(move_info)

  // illegal move
  if (move === null) return 'snapback'

  socket.emit("move", match_id, move_info);

  updateStatus(move)
}

function onMouseoverSquare (square, piece) {
  if(game.game_over() || !is_room_full || game.turn() != my_turn) return;

  // get list of possible moves for this square
  var moves = game.moves({
    square: square,
    verbose: true
  })

  // exit if there are no moves available for this square
  if (moves.length === 0) return

  // highlight the square they moused over
  greySquare(square)

  // highlight the possible squares for this piece
  for (var i = 0; i < moves.length; i++) {
    greySquare(moves[i].to)
  }

  //console.log(game.get(square))
}

function onMouseoutSquare (square, piece) {
  removeGreySquares()
}

function onSnapEnd () {
  board.position(game.fen())
  //board.flip()
}

function updateStatus (move, update_point = true) {

  //game.put({ type: game.QUEEN, color: game.WHITE }, 'a1')
  //game.put({ type: game.QUEEN, color: game.WHITE }, 'a2')

  var status = '';

  /*if(move != null){
    console.log(game.get(move.to));
  }*/

  var moveColor = 'White';
  if (game.turn() === 'b') {
    moveColor = 'Black'
  }

  nMoves++;

  // checkmate?
  if (game.in_checkmate()) {
    status = 'Game over, ' + moveColor + ' is in checkmate.';
    $gacha.attr('disabled', true)
    if(moveColor === 'Black')
    socket.emit("game finished", match_id, (moveColor === 'Black')? 1 : 2);
  }

  // draw?
  else if (game.in_draw()) {
    status = 'Game over, drawn position'
    $gacha.attr('disabled', true)
    socket.emit("game finished", match_id, 3);
  }

  // game still on
  else {
    status = moveColor + ' to move'
    // check?
    if (game.in_check()) {
      status += ', ' + moveColor + ' is in check'
    }
  }

  // console.log(status);

  $status.html(status)
  //$fen.html(game.fen())
  //$pgn.html(game.pgn())
  $gameDetails.html("Black's point: " + black_points + "<br>White's point: " + white_points)

}































// var messages = document.getElementById('messages');

// //  Username register
// var register_form = document.getElementById('register-form');
// var username_input = document.getElementById('username-input');
// var user = "";

// register_form.addEventListener('submit', (e) => {
//     e.preventDefault();
//     if (username_input.value) {
//         socket.emit('registered', username_input.value);
//         user = username_input.value;
//         var item = document.getElementById("username");
//         item.innerHTML = user;
//         console.log(document.getElementById("chat-room"));
//         document.getElementById("chat-room").hidden = false;
//         document.getElementById("register-form").hidden = true;
//         username_input.value = '';
//     }
// });

// socket.on('registered', (username) => {
//     var item = document.createElement('li');
//     item.textContent = `${username} has entered the chat.`;
//     messages.appendChild(item);
//     window.scrollTo(0, document.body.scrollHeight);
// });


// // Chat

// var form = document.getElementById('chat-form');
// var input = document.getElementById('input');

// form.addEventListener('submit', (e) => {
//     e.preventDefault();
//     if (input.value) {
//         socket.emit('chat message', user, input.value);
//         input.value = '';
//     }
// });

// socket.on('chat message', (username, msg) => {
//     var item = document.createElement('li');
//     item.innerHTML = `<b ${(user == username)? "style='color: green'" : ""}>${username}</b>: ${msg}`;
//     messages.appendChild(item);
//     window.scrollTo(0, document.body.scrollHeight);
// });

// socket.on('leaving', (username) => {
//     var item = document.createElement('li');
//     item.innerHTML = `<b>${username}</b> has <b style='color: red'>disconnected</b>.`;
//     messages.appendChild(item);
//     window.scrollTo(0, document.body.scrollHeight);
// })