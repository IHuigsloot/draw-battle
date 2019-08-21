const path = require('path')
const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http);
const port = process.env.PORT || 3000;

const { addUser, removeUser, getUser, getUsers } = require('./utils/users')
const words = require('./utils/words.json')

const publicDirectoryPath = path.join(__dirname, '../public')

app.use(express.static(publicDirectoryPath))

var line_history = [];
var info = "waiting for players..."
var drawer = ''
var drawing = ''
var tips = []
var game = 'wait'

var chooseTimer
var drawTimer

io.on('connection', function (socket) {
    socket.on('join', (username, callback) => {
        const { error, user } = addUser({ id: socket.id, username })

        var users = getUsers();

        if (users.length < 2) {
            info = "waiting for players"
        } else {
            if (game === 'wait') {
                startGame()
            }
        }

        socket.emit('info', info)

        if (error) {
            return callback(error)
        }
        playerslist()

        callback()
    })

    for (var i in line_history) {
        socket.emit('draw_line', { line: line_history[i] });
    }

    socket.on('draw_line', function (data) {
        if (!(data.id === drawer.id)) {
            return
        }
        line_history.push(data.line);
        io.emit('draw_line', { line: data.line });
    });

    socket.on('answer', (data) => {
        if (game !== 'started') {
            return
        }

        if (!(data.answer.toLowerCase() === drawing.toLowerCase())) {
            return socket.emit('alert', 'Wrong!')
        }

        var user = getUser(data.id)

        io.emit('alert', `${user.username} has guessed ${drawing}!`)
        newRound()
    })

    socket.on('clear', () => {
        io.emit('clear', 0)
        line_history = []
    })

    socket.on('clearToolboxes', () => {
        socket.broadcast.emit('clearToolbox')
    })

    socket.on('select', (data) => {
        game = 'started'
        drawing = data.select

        clearTimeout(chooseTimer)

        info = (drawer.username + ' is now drawing')
        io.to(drawer.id).emit('draw')
        io.emit('info', info)
    })

    socket.on('getLines', () => {
        for (var i in line_history) {
            io.to(socket.id).emit('draw_line', { line: line_history[i] });
        }

    })

    socket.on('disconnect', () => {
        removeUser(socket.id)
        var users = getUsers()

        playerslist()

        if (users.length < 2) {
            return stopGame()
        }

        if (socket.id === drawer.id) {
            io.emit('alert', 'The drawer left the server')
            return newRound()
        }
    })

    startGame = () => {
        game = 'starting'
        clearTimeout(drawTimer)
        newRound()
    }

    newRound = () => {
        stopTimers()
        io.emit('clear', 2000)
        line_history = []
        tips = []

        var easy = words.easy[Math.floor(Math.random() * words.easy.length)];
        var medium = words.medium[Math.floor(Math.random() * words.medium.length)];
        var hard = words.hard[Math.floor(Math.random() * words.hard.length)];

        var users = getUsers()

        var rand = users[Math.floor(Math.random() * users.length)];
        drawer = rand

        info = (drawer.username + ' is now choosing');

        chooseTimer = setTimeout(() => {
            io.to(drawer.id).emit('kick')
        }, 16000)

        tipTimer = setInterval(() => {
            if (tips.length === 0) {
                for (let i = 0; i < drawing.length; i++) {
                    tips.push('')
                }
                return io.emit('tip', tips)
            }
            var index = Math.floor(Math.random() * drawing.length);
            var letter = drawing.charAt(index);

            tips.splice(index, 1, letter)

            io.emit('tip', tips)
        }, 15000);

        drawTimer = setTimeout(() => {
            return newRound()
        }, 76000)

        io.emit('info', info)
        io.to(drawer.id).emit('drawer', { easy, medium, hard })
    }

    stopGame = () => {
        game = 'wait'
        line_history = []
        io.emit('clear', 0)

        info = "waiting for players..."
        io.emit('info', info)

        stopTimers()
    }

    stopTimers = () => {
        if (typeof drawTimer !== "undefined") {
            clearTimeout(drawTimer);
        }
        if (typeof tipTimer !== "undefined") {
            clearTimeout(tipTimer);
        }
    }

    playerslist = () => {
        var players = getUsers().map((player) => {
            return player.username
        })
        io.emit('playerlist', players)
    }

});

http.listen(port, () => console.log('listening on port ' + port));