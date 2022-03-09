// import express from 'express';
// import { createServer } from 'http';
// import { Server } from "socket.io";
// const sess

// import { fileURLToPath } from 'url';
// import { dirname } from 'path';

// import * as Chess from "./static/js/chess.js";

// import * as authRouters from "./authRoutes.js"

// const app = express();
// const server = createServer(app);
// const io = new Server(server);

// app.use(session({
//     secret: 'wAb^?HVB2Gc!^}fFf*nu7QV!oUgv;/UC,7BF/+q01C@4,`@4BL$,b:(KpN^(M:N',
//     resave: false,
//     saveUninitialized: true,
//     cookie: { 
//         secure: true,
//         maxAge: 2*60*1000
//     }
// }));

// const __filename = fileURLToPath(import.meta.url);
// const __dirname = dirname(__filename);

// app.use(express.static(__dirname + '/static'));

// let users = {};
// let nMatches = 0;
// let match = {};

// app.get('/', (req, res) => {
//     res.sendFile(__dirname + '/index.html');
// });

// app.get('/auth', authRouters);

// app.get('/client.js', (req, res) => {
//     res.sendFile(__dirname + "/client.js");
// })

// io.on('connection', (socket) => {

//     console.log(match.hasOwnProperty(nMatches));
//     if(!match.hasOwnProperty(nMatches)) match[nMatches] = 0;
//     if(match[nMatches] == 2) match[++nMatches] = 0;
//     match[nMatches]++;
//     users[socket.id] = nMatches
//     console.log(socket.id, nMatches, match[nMatches]);
//     io.emit('registered', socket.id, nMatches, (match[nMatches] == 2)? true : false);


//     socket.on('move', (match_id, fen) => {
//         io.emit('move', match_id, fen);
//     });

//     socket.on('point changed', (matchid, changed_player, new_point) => {
//         console.log(matchid, changed_player, new_point);
//         io.emit('point changed', matchid, changed_player, new_point);
//     });
    
//     socket.on('disconnect', () => {
//         io.emit("leaving", users[socket.id]);
//         delete match[users[socket.id]];
//         delete users[socket.id];
//     });
// });

// server.listen(3000, () => {
//     console.log('listening on *:3000');
// });

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
    res.render('index.ejs', { name: req.user.username, match: match, messages: msg })
})

app.get('/login', checkNotAuthenticated, (req, res) => {
    let msg = {}
    if(req.query.loginconflict) msg.error = "This account has already been logged in elsewhere"
    res.render('login.ejs', {messages: msg})
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

    res.redirect('/game');
});

app.get('/game', checkAuthenticated, (req, res) => {
    let user_id = get_user_id(req.user.username);
    if(user_id == null || !users[user_id].in_game){
        return res.redirect('/');
    }
    let match = {};
    match.id = users[user_id].in_game;

    res.render('game.ejs', { name: req.user.username, match: match })
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

const http = require('http');
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server);
const index_io = io.of("/index");
const game_io = io.of("/game");

const { Chess } = require('chess.js');

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
                white_player: socket.request.user.username,
                white_points: gacha_price,
                black_player: null,
                black_points: gacha_price - 1,
                result: 0,
                cached: false
            }
            matches_history.push(new_match);

            write_json(matches_history, "database/matches.json");
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

    socket.on('point changed', (matchid, changed_player, delta) => {
        let matches_history = read_json("database/matches.json");
        let game_id = find_match(matches_history, matchid);

        if(changed_player == 'w'){
            matches_history[game_id].white_points += delta;
            game_io.emit('point changed', matchid, changed_player, matches_history[game_id].white_points)
        } else{
            matches_history[game_id].black_points += delta;
            game_io.emit('point changed', matchid, changed_player, matches_history[game_id].black_points)
        }
        write_json(matches_history, "database/matches.json");
    });

    socket.on('game finished', (matchid, result) => {
        game_io.emit(matchid, result);
    })
    
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