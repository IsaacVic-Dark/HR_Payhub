<?php

namespace App\Models;

use App\Services\DB;

class User
{
    public static function findByEmail($email)
    {
        $db = DB::getInstance();
        $stmt = $db->prepare("SELECT * FROM users WHERE email = :email");
        $stmt->execute([':email' => $email]);
        return $stmt->fetch(\PDO::FETCH_ASSOC);
    }

    public static function find($id)
    {
        $db = DB::getInstance();
        $stmt = $db->prepare("SELECT * FROM users WHERE id = :id");
        $stmt->execute([':id' => $id]);
        return $stmt->fetch(\PDO::FETCH_ASSOC);
    }

    public static function create($data)
    {
        $db = DB::getInstance();
        $stmt = $db->prepare("
            INSERT INTO users (organization_id, username, first_name, middle_name, surname, password_hash, email, user_type) 
            VALUES (:organization_id, :username, :first_name, :middle_name, :surname, :password_hash, :email, :user_type)
        ");
        
        return $stmt->execute([
            ':organization_id' => $data['organization_id'],
            ':username' => $data['username'],
            ':first_name' => $data['first_name'],
            ':middle_name' => $data['middle_name'] ?? null,
            ':surname' => $data['surname'],
            ':password_hash' => $data['password_hash'],
            ':email' => $data['email'],
            ':user_type' => $data['user_type'] ?? 'employee'
        ]);
    }
}