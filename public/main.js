document.addEventListener("DOMContentLoaded", function () {
    window.onresize = () => {
        setTimeout(() => location.reload(), 25)
    }
    var mouse = {
        click: false,
        move: false,
        pos: { x: 0, y: 0 },
        pos_prev: false
    };
    // get canvas element and create context
    var canvas = document.getElementById('drawing');
    var colors = document.getElementsByClassName('color');
    var options = document.getElementsByClassName('option')
    var answerform = document.getElementById('answer-form');
    var answer = document.getElementById('answer')
    var context = canvas.getContext('2d');
    var width = window.innerWidth;
    var height = window.innerHeight;
    var socket = io.connect();

    const { username } = Qs.parse(location.search, { ignoreQueryPrefix: true });

    const $alerts = document.querySelector('#alerts');
    const $info = document.querySelector('#info');
    const $options = document.querySelector('#options');
    const clear = document.querySelector('#clear');
    const toolbox = document.querySelector('#toolbox');
    const select = document.querySelector('#select')
    const answerInput = document.querySelector('#answer-input')

    // Templates
    const alertTemplate = document.querySelector('#alert-template').innerHTML
    const infoTemplate = document.querySelector('#info-template').innerHTML
    const optionTemplate = document.querySelector('#option-template').innerHTML

    var current = {
        color: 'black'
    };

    // set canvas to full browser width/height
    canvas.width = width;
    canvas.height = height;

    // register mouse event handlers
    canvas.onmousedown = function (e) { mouse.click = true; };
    canvas.onmouseup = function (e) { mouse.click = false; };

    canvas.onmousemove = function (e) {
        // normalize mouse position to range 0.0 - 1.0
        mouse.pos.x = e.clientX / width;
        mouse.pos.y = e.clientY / height;
        mouse.move = true;
    };

    answerform.addEventListener('submit', (e) => {
        e.preventDefault()
        const answer = e.target.elements.answer.value

        if (answer === '') {
            return
        }

        answerInput.value = ''
        answerInput.focus()

        socket.emit('answer', { answer, id: socket.id })
    })

    clear.addEventListener('click', () => {

        socket.emit('clear')
    })

    for (var i = 0; i < colors.length; i++) {
        colors[i].addEventListener('click', onColorUpdate, false);
    }

    for (var i = 0; i < options.length; i++) {
        options[i].addEventListener('click', (e) => {
            console.dir(e.target.attributes.name.value)
        }, false);
    }

    // draw line received from server
    socket.on('draw_line', function (data) {
        var line = data.line;
        context.beginPath();
        context.moveTo(line[0].x * width, line[0].y * height);
        context.lineTo(line[1].x * width, line[1].y * height);
        context.strokeStyle = line[2];
        context.lineWidth = 3;
        context.stroke();
    });

    // main loop, running every 25ms
    function mainLoop() {
        // check if the user is drawing
        if (mouse.click && mouse.move && mouse.pos_prev) {
            // send line to to the server
            socket.emit('draw_line', { line: [mouse.pos, mouse.pos_prev, current.color], id: socket.id });
            mouse.move = false;
        }
        mouse.pos_prev = { x: mouse.pos.x, y: mouse.pos.y };
        setTimeout(mainLoop, 25);
    }

    function onColorUpdate(e) {
        current.color = e.target.className.split(' ')[1];
    }

    function sendAlert(message) {
        const html = Mustache.render(alertTemplate, {
            alert: message
        })
        $alerts.insertAdjacentHTML('beforeend', html)

        setTimeout(() => {
            $alerts.innerHTML = ''
        }, 2000)
    }

    socket.emit('join', username, (error) => {
        sendAlert('joined the server')

        if (error) {
            alert(error)
            location.href = '/'
        }
    })

    socket.on('alert', (alert) => {
        console.log(alert)
        sendAlert(alert)
    })

    socket.on('clear', (time) => {
        setTimeout(() => {
            context.clearRect(0, 0, canvas.width, canvas.height);
        }, time)
    })

    socket.on('info', (info) => {
        const html = Mustache.render(infoTemplate, {
            info
        })
        $info.innerHTML = html
    })

    socket.on('drawer', (options) => {
        console.log('You are the drawer')
        select.style.display = 'block';
        answer.style.display = 'none';
        toolbox.style.display = "none";

        const html = Mustache.render(optionTemplate, {
            easy: options.easy,
            medium: options.medium,
            hard: options.hard
        })
        $options.innerHTML = html

        socket.emit('clearToolboxes')
    })

    socket.on('clearToolbox', () => {
        toolbox.style.display = "none";
        select.style.display = 'none';
        answer.style.display = 'block';
    })

    socket.on('draw', () => {
        select.style.display = 'none'
        toolbox.style.display = "block";
    })

    mainLoop();
});

