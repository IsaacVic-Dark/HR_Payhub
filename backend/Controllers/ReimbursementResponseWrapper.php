<?php
// app/Controllers/ReimbursementResponseWrapper.php
//
// Tiny wrapper so a private findOrFail()-style helper can return either the
// row it found, or a ready-made error responseJson() to short-circuit with.
// Kept in its own file (one class per file) so PSR-4 autoloading resolves it
// correctly regardless of whether ReimbursementController or
// ReimbursementItemController is the one that references it first.

namespace App\Controllers;

class ReimbursementResponseWrapper
{
    public $response;

    public function __construct($response)
    {
        $this->response = $response;
    }
}