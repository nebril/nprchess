var context = require('rabbit.js').createContext('amqp://localhost')
	, Sequence = require('sequence').Sequence;

process.on('uncaughtException', function (error) {
   console.log(error.stack);
});

var user = {
	guid : guid(),
	white : process.argv[2] ? true : false
};
console.log('I am ', user);

var game = {
    guid : null,
    moves : []
};


//find player or announce your presence
var s = Sequence.create();
var blacks;
s.then(function(next) {
    //player matching
    context.on('ready', function(){
        if(user.white){ 
            blacks = context.socket('PULL');
        }else {
            blacks = context.socket('PUSH');
        }
        blacks.setsockopt('prefetch',1);

        blacks.connect('BLACK', function(){
            if(!user.white){
                var gameIdQ = context.socket('PULL');
                var interval = setInterval(function(){
                    blacks.write(JSON.stringify(user), 'utf-8');
                }, 1000);
                gameIdQ.connect(user.guid);
                gameIdQ.on('data', function(data){
                    clearInterval(interval);
                    game = JSON.parse(data.toString());
                    next(game);
                });
            }
        });

        
        if(user.white){
            found = false;
            blacks.on('data', function(data){
                if(!found) {
                    found = true;
                    black = JSON.parse(data.toString());
                    game.guid = guid();
                    var gameIdQ = context.socket('PUSH');
                    gameIdQ.connect(black.guid,function(){
                        gameIdQ.write(JSON.stringify(game), 'utf-8');
                        next(game);
                    });
                }
            });
        }
    });
}).then(function(next,game){
    console.log("commencing next",game);
   
    var pub = context.socket('PUB');
    var sub = context.socket('SUB');

    sub.connect(game.guid,function(){
        pub.connect(game.guid, function(){
            console.log('connected to pub');
            if(user.white) {
                makeMove(); 
            }
        });
    });

    sub.on('data', function(data) {    
        var move = JSON.parse(data.toString());
        game.moves.push(move);
        if(move.white != user.white) {
            makeMove();
        }
    });

    var makeMove = function(){
        setTimeout(function() {
        var move = {
            white : user.white,
            action : s4()
        };

        pub.write(JSON.stringify(move), 'utf-8');
        }, 1000);
    };
});

setInterval(function() {
    console.log(game.moves);
},1000);

function guid() {
  return s4() + s4() + '-' + s4() + '-' + s4() + '-' +
         s4() + '-' + s4() + s4() + s4();
}

function s4() {
  return Math.floor((1 + Math.random()) * 0x10000)
             .toString(16)
             .substring(1);
};
