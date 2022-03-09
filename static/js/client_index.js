var socket = io("/index")
var form = document.getElementById('create_game');

console.log(socket.request);


socket.on('redirect', (destination) => {
    window.location.href = destination;
});

form.addEventListener('submit', (e) => {
    e.preventDefault();
    console.log("FUCK YOU");
    socket.emit("create_game");
});