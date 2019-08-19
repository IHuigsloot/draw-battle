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
var info = "waiting for players"
var drawer = ''
var drawing = ''
var game = 'wait'

io.on('connection', function (socket) {
    socket.on('join', (username, callback) => {
        const { error, user } = addUser({ id: socket.id, username })

        var users = getUsers();

        console.log(game);


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

        callback()
    })


    for (var i in line_history) {
        socket.emit('draw_line', { line: line_history[i] });
    }
    socket.on('draw_line', function (data) {
        if (!(data.id === drawer.id)) {
            return
        }
        console.log(data);
        line_history.push(data.line);
        io.emit('draw_line', { line: data.line });
    });

    socket.on('answer', (data) => {
        if (game !== 'started') {
            return
        }

        if (!(data.answer.toLowerCase() === drawing.toLowerCase())) {
            return socket.emit('alert', 'fout')
        }

        var user = getUser(data.id)

        io.emit('alert', `${user.username} heeft het goed geraden!`)
        newRound()
    })

    socket.on('clear', () => {
        io.emit('clear', 0)
        line_history = []
    })

    socket.on('clearToolboxes', () => {
        console.log('test');

        socket.broadcast.emit('clearToolbox')
    })

    socket.on('select', (data) => {
        game = 'started'
        drawing = data.select

        info = (drawer.username + ' is now drawing')
        io.to(drawer.id).emit('draw')
        io.emit('info', info)
    })

    socket.on('disconnect', () => {
        removeUser(socket.id)
        var users = getUsers()

        if (socket.id === drawer.id) {
            io.emit('alert', 'The drawer left the server')
            return newRound()
        }

        if (users.length < 2) {
            stopGame()
        }

    })

    startGame = () => {
        game = 'starting'
        newRound()
    }

    newRound = () => {
        io.emit('clear', 2000)
        line_history = []

        var easy = words.easy[Math.floor(Math.random() * words.easy.length)];
        var medium = words.medium[Math.floor(Math.random() * words.medium.length)];
        var hard = words.hard[Math.floor(Math.random() * words.hard.length)];

        var users = getUsers()

        var rand = users[Math.floor(Math.random() * users.length)];
        drawer = rand

        info = (drawer.username + ' is now choosing');

        io.emit('info', info)
        io.to(drawer.id).emit('drawer', { easy, medium, hard })
    }

    stopGame = () => {
        game = 'wait'
        line_history = []
        io.emit('clear', 0)

        info = "waiting for players"
        socket.emit('info', info)
    }
});



http.listen(port, () => console.log('listening on port ' + port));