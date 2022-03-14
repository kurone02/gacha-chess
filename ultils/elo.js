let players = () => {
    let elo = 1200;
    let k_factor = 25;

    function get_elo(){
        return elo;
    }

    function get_k_factor(){
        return k_factor;
    }

    function adjust_k_factor(){
        if(elo < 1600){
            k_factor = 30;
        } else if(elo < 2000){
            k_factor = 25;
        } else if(elo < 2400){
            k_factor = 20;
        } else{
            k_factor = 10;
        }
    }

    function initialize(rating){
        elo = rating;
        adjust_k_factor();
    }

    function get_expected_score(opponent){
        let q_a = Math.pow(10, elo / 400);
        let q_b = Math.pow(10, opponent.get_elo() / 400);
        return q_a / (q_a + q_b);
    }

    return {
        get_elo: get_elo,
        get_k_factor: get_k_factor,
        initialize: initialize,
        get_expected_score: get_expected_score
    };
}


let elo_system = () => {

    // Private methods

    let player_1 = players();
    let player_2 = players();

    // Public methods

    // Initialize two players' ratings
    function initialize(p1, p2){
        player_1.initialize(p1);
        player_2.initialize(p2);
    }

    function get_new_ratings(result){
        let e_a = player_1.get_expected_score(player_2);
        let r_a = player_1.get_elo();
        let k_a = player_1.get_k_factor();
        let e_b = player_2.get_expected_score(player_1);
        let r_b = player_2.get_elo();
        let k_b = player_2.get_k_factor();
        console.log(result, e_a, r_a, k_a, e_b, r_b, k_b);
        return [Math.round(r_a + k_a * (result - e_a)), Math.round(r_b + k_b * (1 - result - e_b))];
    }

    return {
        initialize: initialize,
        get_new_ratings: get_new_ratings
    }

}


module.exports = elo_system();