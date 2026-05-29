<?php

namespace App\Services\Delivery;

use App\Models\DeliveryCompany;
use App\Services\Delivery\Contracts\DeliveryProviderInterface;
use App\Services\Delivery\Providers\AmanaDeliveryProvider;
use App\Services\Delivery\Providers\AmeexDeliveryProvider;
use App\Services\Delivery\Providers\ManualDeliveryProvider;
use App\Services\Delivery\Providers\SenditDeliveryProvider;

class DeliveryProviderFactory
{
    public function forCompany(?DeliveryCompany $company): DeliveryProviderInterface
    {
        $code = $company ? mb_strtolower((string) ($company->code ?? '')) : '';

        return match ($code) {
            'sendit' => new SenditDeliveryProvider($company),
            'ameex' => new AmeexDeliveryProvider($company),
            'amana' => new AmanaDeliveryProvider($company),
            default => new ManualDeliveryProvider,
        };
    }
}
