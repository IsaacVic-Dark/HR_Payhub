<?php

namespace App\Services;

/** Business-rule failure carrying an HTTP code and field-level errors. */
class AdvanceException extends \Exception
{
    public int $httpCode;
    public array $errors;

    public function __construct(string $message, int $httpCode = 422, array $errors = [])
    {
        parent::__construct($message);
        $this->httpCode = $httpCode;
        $this->errors   = $errors;
    }
}