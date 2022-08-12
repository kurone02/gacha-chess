const fs = require('fs');
const path = require('path')

let logged_in_users = []

const express = require('express')
const app = express()
const bcrypt = require('bcrypt')
const passport = require('passport')
const flash = require('express-flash')
const session = require('express-session')
const methodOverride = require('method-override')


const users = read_json('database/accounts.json');
// console.log(users)

const initializePassport = require('./passport-config')
initializePassport(
  passport,
  username => users.find(user => user.username === username),
  id => users.find(user => user.id === id)
)

let sessionMiddleware = session({
    secret: 'wAb^?HVB2Gc!^}fFf*nu7QV!oUgv;/UC,7BF/+q01C@4,`@4BL$,b:(KpN^(M:N',
    resave: false,
    saveUninitialized: true
});

app.set('view-engine', 'ejs')
const static_path = path.join(__dirname, 'static');
app.use("/static", express.static(static_path));
app.use("/img", express.static(path.join(__dirname, 'views/img')));
app.use("/giertugheiurgherg", express.static(path.join(__dirname, 'views/templates')));
app.use("/css", express.static(path.join(__dirname, 'views/css')));
app.use("/js", express.static(path.join(__dirname, 'views/js')));
app.use(express.urlencoded({ extended: false }))
app.use(flash())
app.use(sessionMiddleware);
app.use(passport.initialize())
app.use(passport.session())
app.use(methodOverride('_method'))

app.get('/', checkAuthenticated, (req, res) => {
    let user_id = get_user_id(req.user.username);
    let match = {};
    if(user_id != null && users[user_id].in_game != null){
        match.id = users[user_id].in_game
    }
    let msg = {}
    if(req.query.gamenotexist) msg.error = "This game does not exist"
    if(req.query.loginconflict){
        if(msg.error) msg.error += "\nThis account has already been playing elsewhere"
        else msg.error += "This account has already been playing elsewhere"
    }

    let matches_history = read_json("database/matches.json");

    let ongoing_matches = [];
    let finished_matches = [];
    let waiting_matches = [];

    for(let i = 0; i < matches_history.length; i++){
        let current_match = matches_history[i];
        if(current_match.id === -1 || current_match.result === -1) continue;
        if(current_match.black_player == null) waiting_matches.push(current_match);
        else if(current_match.result === 0) ongoing_matches.push(current_match);
        else finished_matches.push(current_match);
    }

    // for(let i = 0; i < waiting_matches.length; i++){
    //     console.log(waiting_matches[i]);
    // }

    res.render('index.ejs', {  
        name: req.user.username, match: match, messages: msg, 
        ongoing_matches: ongoing_matches, 
        finished_matches: finished_matches, 
        waiting_matches: waiting_matches,
        ranked_user: get_ranked()
    })
})

app.get('/login', checkNotAuthenticated, (req, res) => {
    let msg = {}
    if(req.query.loginconflict) msg.error = "This account has already been logged in elsewhere"
    res.render('login.ejs', {messages: msg, ranked_user: get_ranked()})
})

app.post('/login', checkNotAuthenticated, passport.authenticate('local', {
    successRedirect: '/',
    failureRedirect: '/login',
    failureFlash: true
}))

app.delete('/logout', (req, res) => {
    req.logOut()
    res.redirect('/login')
})

app.post('/resume_game', checkAuthenticated, (req, res) => {
    let user_id = get_user_id(req.user.username);
    if(user_id == null || !users[user_id].in_game){
        return res.redirect('/');
    }
    res.redirect('/game');
})

app.post('/join_game', checkAuthenticated, (req, res) => {
    let user_id = get_user_id(req.user.username);
    if(user_id == null || users[user_id].in_game){
        return res.redirect('/');
    }

    let matches_history = read_json("database/matches.json");
    let game_id = find_match(matches_history, req.body.join_game)
    if(game_id == null){
        return res.redirect('/?gamenotexist=true')
    }
    
    users[user_id].in_game = matches_history[game_id].id
    matches_history[game_id].black_player = req.user.username;
    write_json(matches_history, "database/matches.json");
    write_json(users, "database/accounts.json");

    res.redirect('/game');
});

app.get('/game', checkAuthenticated, (req, res) => {
    let user_id = get_user_id(req.user.username);
    if(user_id == null || !users[user_id].in_game){
        return res.redirect('/');
    }
    let match = {};
    match.id = users[user_id].in_game;

    res.render('game.ejs', { name: req.user.username, match: match, ranked_user: get_ranked() })
})

function checkAuthenticated(req, res, next) {
    if (req.isAuthenticated()) {
        return next()
    }
    res.redirect('/login')
}

function checkNotAuthenticated(req, res, next) {
    if (req.isAuthenticated()) {
        return res.redirect('/')
    }
    next()
}

function read_json(file_name){
    return JSON.parse(fs.readFileSync(file_name));
}

function write_json(json_data, file_name){
    fs.writeFileSync(file_name, JSON.stringify(json_data, null, 4));
}

function get_user_id(user_name){
    for(let i = 0; i < users.length; i++){
        if(users[i].username == user_name){
            return i;
        }
    }
    return null;
}

function find_match(matches, match_id){
    for(let i = 0; i < matches.length; i++){
        if(matches[i].id == match_id){
            return i;
        }
    }
    return null;
}

function get_ranked(){
    let ranked_user = [...users];
    ranked_user.sort((x, y) => y.elo - x.elo);
    return ranked_user;
}

function change_rank(user_id){
    let elo = users[user_id].elo;
    if(elo < 1200){
        users[user_id].rank = "Newbie";
        users[user_id].rank_css = "Newbie";
    } else if(elo < 1400){
        users[user_id].rank = "Pupil";
        users[user_id].rank_css = "Pupil";
    } else if(elo < 1600){
        users[user_id].rank = "Specialist";
        users[user_id].rank_css = "Specialist";
    } else if(elo < 1900){
        users[user_id].rank = "Expert";
        users[user_id].rank_css = "Expert";
    } else if(elo < 2100){
        users[user_id].rank = "Candidate Master";
        users[user_id].rank_css = "CandidateMaster";
    } else if(elo < 2300){
        users[user_id].rank = "Master";
        users[user_id].rank_css = "Master";
    } else if(elo < 2400){
        users[user_id].rank = "International Master";
        users[user_id].rank_css = "InternationalMaster";
    } else if(elo < 2600){
        users[user_id].rank = "Grandmaster";
        users[user_id].rank_css = "Grandmaster";
    } else{
        users[user_id].rank = "International Grandmaster";
        users[user_id].rank_css = "InternationalGrandmaster";
    }
}

const http = require('http');
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server);
const index_io = io.of("/index");
const game_io = io.of("/game");

const elo_system = require("./ultils/elo.js");

const { Chess } = require('chess.js');
const { findSourceMap } = require('module');
const { finished } = require('stream');
const { match } = require('assert');

const gacha_price = 7;
const weighted_probability = [
    ['n', 18],
    ['b', 18],
    ['r', 8],
    ['q', 4]
  ];
const piecePoints = {
    'p': 1,
    'cp': 1,
    'n': 3,
    'b': 3,
    'r': 5,
    'q': 9,
    'k': Infinity
};

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

let passport_initialize = passport.initialize();
let passport_session = passport.session();

const wrap = middleware => (socket, next) => middleware(socket.request, {}, next);
index_io.use(wrap(sessionMiddleware));
index_io.use(wrap(passport_initialize));
index_io.use(wrap(passport_session));
index_io.use((socket, next) => {
    if (socket.request.user) {
      next();
    } else {
      next(new Error("unauthorized"))
    }
});

game_io.use(wrap(sessionMiddleware));
game_io.use(wrap(passport_initialize));
game_io.use(wrap(passport_session));
game_io.use((socket, next) => {
    if (socket.request.user) {
      next();
    } else {
      next(new Error("unauthorized"))
    }
});

index_io.on('connection', (socket) => {

    socket.on("create_game", () => {
        let user_id = get_user_id(socket.request.user.username);
        if(user_id == null || users[user_id].in_game){
            socket.emit('redirect', '/');
        } else{
            let matches_history = read_json("database/matches.json");
            let new_match_id = matches_history.length;

            users[user_id].in_game = new_match_id;
            let new_match = {
                id: new_match_id,
                fen: "ppppkppp/pppppppp/8/8/8/8/PPPPPPPP/PPPPKPPP w - - 0 1",
                // fen: "2k3R1/7R/8/8/8/8/8/8 w - - 0 1",
                // fen: "3k2R1/8/4p3/8/8/8/8/3K4 b - - 0 1",
                white_player: socket.request.user.username,
                white_points: gacha_price,
                black_player: null,
                black_points: gacha_price - 1,
                result: 0,
                cached: false
            }
            matches_history.push(new_match);

            write_json(matches_history, "database/matches.json");
            write_json(users, "database/accounts.json");
            console.log(`${socket.request.user.username} created a game`);

            socket.emit('redirect', `/game`);
        }
    });
});

game_io.on('connection', (socket) => {

    if(logged_in_users.includes(socket.request.user.username)){
        socket.emit('redirect', '/?loginconflict=true');
        return;
    }

    logged_in_users.push(socket.request.user.username);

    socket.on('get game', () => {
        let user_id = get_user_id(socket.request.user.username);
        if(user_id == null || !users[user_id].in_game){
            socket.emit('redirect', '/');
        } else{
            let matches_history = read_json("database/matches.json");
            let game_id = find_match(matches_history, users[user_id].in_game)
            if(matches_history[game_id].white_player == socket.request.user.username){
                socket.emit('get game', matches_history[game_id], 'w');
            } else{
                socket.emit('get game', matches_history[game_id], 'b');
            }
        }
    });

    socket.on('start game', () => {
        let user_id = get_user_id(socket.request.user.username);
        if(user_id == null || !users[user_id].in_game){
            socket.emit('redirect', '/');
        } else{
            let matches_history = read_json("database/matches.json");
            let game_id = find_match(matches_history, users[user_id].in_game)
            let is_white_player = (matches_history[game_id].white_player == socket.request.user.username);
            if(!matches_history[game_id].cached){
                game_io.emit('start game', matches_history[game_id], is_white_player? 'w' : 'b');
                matches_history[game_id].cached = true;
                write_json(matches_history, "database/matches.json");
            } else{
                socket.emit('start game', matches_history[game_id], is_white_player? 'w' : 'b');
            }
        }
    });

    socket.on('move', (match_id, move_info) => {       
        let matches_history = read_json("database/matches.json");
        let game_id = find_match(matches_history, match_id);

        let game = new Chess(matches_history[game_id].fen);

        let move = game.move(move_info)
        if(move == null) return;

        if(game.turn() === 'b'){
            matches_history[game_id].black_points++;
            game_io.emit('point changed', match_id, 'b', matches_history[game_id].black_points)
        } else{
            matches_history[game_id].white_points++;
            game_io.emit('point changed', match_id, 'w', matches_history[game_id].white_points)
        }

        if(move['flags'] == 'e' || move['flags'] == 'c' || move['flags'] == 'pc' || move['flags'] == 'cp'){
            game.undo();
            let piece = game.get(move.to);
            let type;
            if(piece == null) type = 'cp';
            else type = game.get(move.to)['type'];
            game.move(move);
            if(game.turn() === 'b'){
                matches_history[game_id].white_points += piecePoints[type];
                game_io.emit('point changed', match_id, 'w', matches_history[game_id].white_points)
            }
            else{
                matches_history[game_id].black_points += piecePoints[type];
                game_io.emit('point changed', match_id, 'b', matches_history[game_id].black_points)
            }
        }

          
        matches_history[game_id].fen = game.fen();
        write_json(matches_history, "database/matches.json");
        game_io.emit('move', match_id, matches_history[game_id]);
    });

    socket.on('gacha', (match_id, rolled_player) => {
        let matches_history = read_json("database/matches.json");
        let game_id = find_match(matches_history, match_id);
        let game = new Chess(matches_history[game_id].fen);

        if(game.in_check()) return;

        if(rolled_player != game.turn()) return;

        if(rolled_player == 'b'){
            if(matches_history[game_id].black_points < gacha_price) return;
            let randomPiece = chooseRandom();
            matches_history[game_id].black_points -= gacha_price;
            write_json(matches_history, "database/matches.json");
            socket.emit('gacha', match_id, randomPiece, matches_history[game_id]);
            game_io.emit('point changed', match_id, 'b', matches_history[game_id].black_points);
        } else{
            if(matches_history[game_id].white_points < gacha_price) return;
            let randomPiece = chooseRandom();
            matches_history[game_id].white_points -= gacha_price;
            write_json(matches_history, "database/matches.json");
            socket.emit('gacha', match_id, randomPiece, matches_history[game_id])
            game_io.emit('point changed', match_id, 'w', matches_history[game_id].white_points)
        }
    });

    socket.on('changed piece', (match_id, rolled_player, piece_info, source) => {
        let matches_history = read_json("database/matches.json");
        let game_id = find_match(matches_history, match_id);
        let game = new Chess(matches_history[game_id].fen);

        if(rolled_player != game.turn()) return;

        console.log(piece_info, source);
        game.put(piece_info, source);
        let tokens = game.fen().split(/\s+/)
        console.log(matches_history[game_id].fen);
        if(tokens[1] == 'w'){
            tokens[1] = 'b';
            matches_history[game_id].black_points++;
            game_io.emit('point changed', match_id, 'b', matches_history[game_id].black_points)
        }
        else{
            tokens[1] = 'w';
            tokens[tokens.length - 1] = Number(tokens[tokens.length - 1]) + 1;
            matches_history[game_id].white_points++;
            game_io.emit('point changed', match_id, 'w', matches_history[game_id].white_points)
        }
        if(!game.validate_fen(tokens.join(' ')).valid){
            tokens[3] = '-';
        }
        matches_history[game_id].fen = tokens.join(' ');
        console.log(matches_history[game_id].fen);
        write_json(matches_history, "database/matches.json");
        game_io.emit('changed piece', match_id, matches_history[game_id]);
    });

    // socket.on('point changed', (matchid, changed_player, delta) => {
    //     let matches_history = read_json("database/matches.json");
    //     let game_id = find_match(matches_history, matchid);

    //     if(changed_player == 'w'){
    //         matches_history[game_id].white_points += delta;
    //         game_io.emit('point changed', matchid, changed_player, matches_history[game_id].white_points)
    //     } else{
    //         matches_history[game_id].black_points += delta;
    //         game_io.emit('point changed', matchid, changed_player, matches_history[game_id].black_points)
    //     }
    //     write_json(matches_history, "database/matches.json");
    // });

    socket.on('game finished', (matchid, result) => {

        let matches_history = read_json("database/matches.json");
        let game_id = find_match(matches_history, matchid);
        let game = new Chess(matches_history[game_id].fen);

        if(!game.in_checkmate() && !game.in_draw()) return;

        let match_point = 0;
        let white_id = get_user_id(matches_history[game_id].white_player);
        let black_id = get_user_id(matches_history[game_id].black_player);
        if(game.in_draw()){
            matches_history[game_id].result = 3;
            game_io.emit('game finished', matchid, 3);
            match_point = 0.5;
        }
        else{
            matches_history[game_id].result = (game.turn() === 'b')? 1 : 2; 
            game_io.emit('game finished', matchid, (game.turn() === 'b')? 1 : 2)
            if(game.turn() === 'b') match_point = 1;
        }

        elo_system.initialize(users[white_id].elo, users[black_id].elo);
        let [old_white_elo, old_black_elo] = [users[white_id].elo, users[black_id].elo]
        [users[white_id].elo, users[black_id].elo] = elo_system.get_new_ratings(match_point);
        users[white_id].in_game = null;
        users[black_id].in_game = null;
        let [white_elo_change, black_elo_change] = [users[white_id].elo - old_white_elo, users[black_id].elo - old_black_elo]

        console.log(`Game ${matches_history[game_id].id} finished, ${match_point === 0.5? 'draw' : (match_point === 0? 'black wins' : 'white wins')}\n`+
        `${users[white_id].username}'s new elo is: ${users[white_id].elo} (${(white_elo_change > 0? '+' : '')}${white_elo_change})\n`+
        `${users[black_id].username}'s new elo is: ${users[black_id].elo} (${(black_elo_change > 0? '+' : '')}${black_elo_change})`);
        
        change_rank(white_id);
        change_rank(black_id);

        write_json(users, "database/accounts.json");
        write_json(matches_history, "database/matches.json");

    });

    socket.on('surrender', (match_id, surrender_player) => {
        let matches_history = read_json("database/matches.json");
        let game_id = find_match(matches_history, match_id);
        
        if(socket.request.user.username != matches_history[game_id].white_player &&
           socket.request.user.username != matches_history[game_id].black_player){
               return;
           }

        if(matches_history[game_id].black_player == null){
            let user_id = get_user_id(socket.request.user.username);
            users[user_id].in_game = null;
            matches_history[game_id].white_player = null;
            matches_history[game_id].result = -1;
        } else{
            let match_point = (surrender_player == 'b')? 1 : 0;
            let white_id = get_user_id(matches_history[game_id].white_player);
            let black_id = get_user_id(matches_history[game_id].black_player);
            elo_system.initialize(users[white_id].elo, users[black_id].elo);
            let [old_white_elo, old_black_elo] = [users[white_id].elo, users[black_id].elo];
            [users[white_id].elo, users[black_id].elo] = elo_system.get_new_ratings(match_point);
            users[white_id].in_game = null;
            users[black_id].in_game = null;
            let [white_elo_change, black_elo_change] = [users[white_id].elo - old_white_elo, users[black_id].elo - old_black_elo]

            matches_history[game_id].result = (surrender_player === 'b')? 1 : 2; 
            console.log(`Game ${matches_history[game_id].id} finished, ${match_point === 0.5? 'draw' : (match_point === 0? 'black wins' : 'white wins')}\n`+
            `${users[white_id].username}'s new elo is: ${users[white_id].elo} (${(white_elo_change > 0? '+' : '')}${white_elo_change})\n`+
            `${users[black_id].username}'s new elo is: ${users[black_id].elo} (${(black_elo_change > 0? '+' : '')}${black_elo_change})`);
            change_rank(white_id);
            change_rank(black_id);
        }

        game_io.emit('surrender', match_id, surrender_player)

        write_json(matches_history, "database/matches.json");
        write_json(users, "database/accounts.json");
    });
    
    socket.on('disconnect', () => {
        logged_in_users = logged_in_users.filter((val, id, arr) => {
            return val != socket.request.user.username;
        });
        game_io.emit("leaving", users[socket.id]);
    });
});

server.listen(3000, () => {
    console.log('listening on *:3000');
});