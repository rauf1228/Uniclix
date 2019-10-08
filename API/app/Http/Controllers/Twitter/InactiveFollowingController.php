<?php

namespace App\Http\Controllers\Twitter;

use Illuminate\Http\Request;
use App\Http\Controllers\Controller;
use Carbon\Carbon;

class InactiveFollowingController extends Controller
{
    private $user;
    private $selectedChannel;

    public function __construct()
    {
        $this->middleware(function ($request, $next) {
            $this->user = auth()->user();

            if(!$this->user->hasPermission("manage-inactive-following")) return response()->json(["error" => "You need to upgrade to unlock this feature."], 403);
            $this->selectedChannel = $this->user->selectedTwitterChannel();
            return $next($request);
        });
    }

    public function feed(Request $request)
    {
        $perPage = 100;
        $months = $request->input('months') ? $request->input('months') : 1;
        $order = $request->input('order') ? $request->input('order') : 'desc';

        $followingIds = $this->selectedChannel->followingIds()
            ->whereNull("unfollowed_at")
            ->orderBy("id", $order)
            ->paginate($perPage)
            ->pluck("user_id")
            ->toArray();

        $items = [];
        $actionsToday = $this->selectedChannel->getDailyStatisticsFor("unfollows");

        if(count($followingIds)){

            try{
               $items = $this->selectedChannel->getUsersLookup($followingIds); 
            }catch(\Exception $e){
                return getErrorResponse($e, $this->selectedChannel->global);
            }
            
            $items = $this->filterInactive($items, $months);
        }

        return response()->json([
            "items" => $items,
            "actions" => $actionsToday
        ]);
    }

    private function filterInactive($items, $months = 1)
    {
        $inactive = [];
        foreach($items as $item){
            if(isset($item->status)){
                $d = Carbon::parse($item->status->created_at);
                if($d < Carbon::now()->subMonths($months)){
                    $inactive[] = $item;
                }
            }
        }

        return $inactive;
    }
}