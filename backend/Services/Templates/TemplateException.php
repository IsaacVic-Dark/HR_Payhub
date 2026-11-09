<?php

namespace App\Services\Templates;

/**
 * Business-rule failure that maps cleanly to an HTTP response.
 */
class TemplateException extends \RuntimeException
{
    /** @var array<string,string> */
    public array $errors;

    public function __construct(string $message, int $httpCode = 422, array $errors = [])
    {
        parent::__construct($message, $httpCode);
        $this->errors = $errors;
    }
}
