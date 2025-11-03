<?php

namespace App\Services;

class ValidationService
{
    public static function validateEmail($email)
    {
        return filter_var($email, FILTER_VALIDATE_EMAIL) !== false;
    }

    public static function validatePassword($password)
    {
        if (strlen($password) < 8) {
            return 'Password must be at least 8 characters long';
        }

        if (!preg_match('/[A-Z]/', $password)) {
            return 'Password must contain at least one uppercase letter';
        }

        if (!preg_match('/[a-z]/', $password)) {
            return 'Password must contain at least one lowercase letter';
        }

        if (!preg_match('/[0-9]/', $password)) {
            return 'Password must contain at least one number';
        }

        return true;
    }

    public static function validateOrganizationData($data)
    {
        $errors = [];

        if (empty(trim($data['organization_name']))) {
            $errors[] = 'Organization name is required';
        }

        if (strlen(trim($data['organization_name'])) < 2) {
            $errors[] = 'Organization name must be at least 2 characters long';
        }

        return empty($errors) ? true : $errors;
    }
}