<?php

namespace App\Controllers;

use App\Services\DB;

class OrganizationController {
    public function index() {
        return responseJson(
            data: DB::table('organizations')->selectAll(),
            message: "Successfull fetch all organisations",
            metadata: ['dev_mode' => true]
        );
    }
    public function create() {
        $data = validate([
            'name' => 'required,string',
            'location' => 'required,string',
            'logo_url' => 'required,string',
            'currency' => 'string'
        ]);

        //insert into db
        $inserted = DB::table('organizations')->insert([
            'name' => $data['name'],
            'location' => $data['location'],
            'logo_url' => $data['logo_url'],
            'currency' => strtoupper($data['currency']),
        ]);

        return responseJson(
            data: $inserted,
            message: "Organization created successfully",
            metadata: ['dev_mode' => true]
        );
    }
}
