<?php

namespace App\Services;

final class Router {

    public static $routes = [
        'GET' => [],
        'POST' => [],
        'PUT' => [],
        'PATCH' => [],
        'DELETE' => [],
    ];
    public static $prefix = '';

    public static function load(string $file) {
        $router = new static;
        require $file;
        return $router;
    }
    public function group(callable $callback): void {
        $callback();
        self::$prefix = ''; // Reset prefix after group
    }

    public static function prefix(string $prefix): static {
        self::$prefix = trim($prefix, '/');
        return new static;
    }

  public static function resource(string $uri, string $controller) {
        // Generate RESTful routes
        $routes = [
            ['GET', $uri, $controller . '@index'],
            ['POST', $uri, $controller . '@store'],
            ['GET', $uri . '/{id}', $controller . '@show'],
            ['PUT', $uri . '/{id}', $controller . '@update'],
            ['DELETE', $uri . '/{id}', $controller . '@destroy'],
        ];

        foreach ($routes as [$method, $routeUri, $controllerAction]) {
            self::__callStatic($method, [$routeUri, $controllerAction]);
        }
    }
    public static function getRoutes(): array {
        return static::$routes;
    }

    public static function clearRoutes(): void {
        static::$routes = [
            'GET' => [],
            'POST' => [],
            'PUT' => [],
            'DELETE' => [],
            'PATCH' => []
        ];
    }

    public static function __callStatic(string $method, array $arguments) {
        $httpMethod = strtoupper($method);

        if (!array_key_exists($httpMethod, static::$routes)) {
            throw new \BadMethodCallException("HTTP method {$httpMethod} is not supported.");
        }

        [$uri, $controller] = $arguments;

        $uri = self::$prefix ? self::$prefix . '/' . trim($uri, '/') : trim($uri, '/');

        // make sure it's not a greedy match, just want to stop at the next '/'
        $uri = preg_replace('/{[^}]+}/', '([^/]+)', $uri);
        // $uri = preg_replace('/{[^}]+}/', '(.+)', $uri);

        static::$routes[$httpMethod][$uri] = $controller;
    }

    public function direct(string $uri, string $requestType): mixed {
       $params = [];
        $matchedRoute = null;
        $matchedController = null;

        // Sort routes by specificity (most specific first)
        $sortedRoutes = static::$routes[$requestType];
        uksort($sortedRoutes, function($a, $b) {
            // Count parameter placeholders - fewer parameters = more specific
            $aParams = substr_count($a, '([^/]+)');
            $bParams = substr_count($b, '([^/]+)');
            
            if ($aParams !== $bParams) {
                return $aParams - $bParams;
            }
            
            // If same number of params, longer route is more specific
            return strlen($b) - strlen($a);
        });

        // Match against sorted routes
        foreach ($sortedRoutes as $route => $controller) {
            // Escape forward slashes for regex
            $pattern = str_replace('/', '\/', $route);
            
            if (preg_match("/^{$pattern}$/", $uri, $matches)) {
                $matchedRoute = $route;
                $matchedController = $controller;
                unset($matches[0]); // remove full match
                $params = array_values($matches);
                break;
            }
        }


        // no route matches
        if ($matchedRoute === null) {
            throw new \Exception("Route {$requestType} /{$uri} does not exist");
        }

        $matchedController = static::$routes[$requestType][$matchedRoute];

        if (is_callable($matchedController)) {
            return $matchedController(...$params);
        }

        if (is_array($matchedController)) {
            return $this->callAction($params, ...$matchedController);
        }

        // Controller@method)
        if (is_string($matchedController)) {
            [$class, $method] = explode('@', $matchedController, 2);
            if (empty($class) || empty($method)) {
                throw new \Exception("Invalid controller format: {$controller}");
            }
            return $this->callAction($params, $class, $method);
        }

        throw new \Exception("Invalid controller type for route {$requestType} /{$uri}");
    }

     public function testDirect(string $uri, string $requestType): mixed {
       $params = [];
        $matchedRoute = null;
        $matchedController = null;

        // Sort routes by specificity (most specific first)
        $sortedRoutes = static::$routes[$requestType];
        uksort($sortedRoutes, function($a, $b) {
            // Count parameter placeholders - fewer parameters = more specific
            $aParams = substr_count($a, '([^/]+)');
            $bParams = substr_count($b, '([^/]+)');
            
            if ($aParams !== $bParams) {
                return $aParams - $bParams;
            }
            
            // If same number of params, longer route is more specific
            return strlen($b) - strlen($a);
        });

        // Match against sorted routes
        foreach ($sortedRoutes as $route => $controller) {
            // Escape forward slashes for regex
            $pattern = str_replace('/', '\/', $route);
            
            if (preg_match("/^{$pattern}$/", $uri, $matches)) {
                $matchedRoute = $route;
                $matchedController = $controller;
                unset($matches[0]); // remove full match
                $params = array_values($matches);
                break;
            }
        }

        if ($matchedRoute) {
            return [
                'controller' => $matchedController,
                'params' => $params,
                'route' => $matchedRoute
            ];
        }

        throw new \Exception("No route found for {$requestType} {$uri}");
    }

    protected function callAction(array $params, string $controller, string $action): mixed {
        if (strpos($controller, "\\") === false) {
            $controller = "App\\Controllers\\{$controller}";
        }

        if (!class_exists($controller)) {
            trigger_error("Class {$controller} does not exist!", E_USER_ERROR);
        }

        $controller = new $controller;

        if (!method_exists($controller, $action)) {
            trigger_error("Method {$action} does not exist on the " . get_class($controller) . " class", E_USER_ERROR);
        }

        return $controller->$action(...$params);
    }
}
