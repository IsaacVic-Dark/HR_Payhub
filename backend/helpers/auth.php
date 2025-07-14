<?php


/**
 * Auth Helper
 * 
 * Returns the status of login & an object helper
 * 
 * @return bool|object Session
 */
function auth() {

    //check if the session is set
    if (!isset($_SESSION['user'])) {
        return false; //not logged in
    }

    $class = new class {

        public $username;
        public $email;
        public $id;

        public function __construct() {
            $user = $_SESSION['user']; //fetch user from session
            $this->username = $user->username ?? null;
            $this->email = $user->email ?? null;
            $this->id =  $user->id ?? null;
        }
        public function __get($name) {
            return $name;
        }
        public function __set($name, $value) {
            $this->$name = $value;
        }
        public function logout() {
            //todo logout
        }
    };

    return $class;
}
