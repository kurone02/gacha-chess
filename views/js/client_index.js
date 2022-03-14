var socket = io("/index")
var form = document.getElementById('create_game');

socket.on('redirect', (destination) => {
    window.location.href = destination;
});

form.addEventListener('submit', (e) => {
    e.preventDefault();
    socket.emit("create_game");
});