<?php

namespace App\Services\Meta;

use RuntimeException;

class MetaApiException extends RuntimeException
{
    public function __construct(
        string $message,
        public readonly ?int $graphCode = null,
        public readonly ?string $graphType = null,
    ) {
        parent::__construct($message);
    }
}
