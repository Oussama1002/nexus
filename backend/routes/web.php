<?php

use App\Http\Controllers\Api\MetaOAuthController;
use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return view('welcome');
});

Route::get('meta/oauth/callback', [MetaOAuthController::class, 'callback']);
