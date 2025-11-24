<?php

namespace App\Services;

final class Router
{

    public static $routes = [
        'GET' => [],
        'POST' => [],
        'PUT' => [],
        'PATCH' => [],
        'DELETE' => [],
        'OPTIONS' => [],
    ];
    public static $prefix = '';

    public static function load(string $file)
    {
        $router = new static;
        require $file;
        return $router;
    }
    public function group(callable $callback): void
    {
        $callback();
        self::$prefix = ''; // Reset prefix after group
    }

    public static function prefix(string $prefix): static
    {
        self::$prefix = trim($prefix, '/');
        return new static;
    }

    public static function getRoutes(): array
    {
        return static::$routes;
    }

    public static function clearRoutes(): void
    {
        static::$routes = [
            'GET' => [],
            'POST' => [],
            'PUT' => [],
            'DELETE' => [],
            'PATCH' => []
        ];
    }


    public function testDirect(string $uri, string $requestType): mixed
    {
        $params = [];
        $matchedRoute = null;
        $matchedController = null;

        // Sort routes by specificity (most specific first)
        $sortedRoutes = static::$routes[$requestType];
        uksort($sortedRoutes, function ($a, $b) {
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

    protected function callAction(array $params, string $controller, string $action): mixed
    {
        if (strpos($controller, "\\") === false) {
            $controller = "App\\Controllers\\{$controller}";
        }

        if (!class_exists($controller)) {
            trigger_error("Class {$controller} does not exist!", E_USER_ERROR);
        }

        // Check if controller uses Singleton pattern
        if (method_exists($controller, 'getInstance')) {
            $controllerInstance = $controller::getInstance();
        } else {
            $controllerInstance = new $controller;
        }

        if (!method_exists($controllerInstance, $action)) {
            trigger_error("Method {$action} does not exist on the " . get_class($controllerInstance) . " class", E_USER_ERROR);
        }

        return $controllerInstance->$action(...$params);
    }

    public static function route(string $method, string $uri, $controller, $middleware = [])
    {
        $httpMethod = strtoupper($method);

        if (!array_key_exists($httpMethod, static::$routes)) {
            throw new \BadMethodCallException("HTTP method {$httpMethod} is not supported.");
        }

        $uri = self::$prefix ? self::$prefix . '/' . trim($uri, '/') : trim($uri, '/');
        $uri = preg_replace('/{[^}]+}/', '([^/]+)', $uri);

        static::$routes[$httpMethod][$uri] = [
            'controller' => $controller,
            'middleware' => (array)$middleware
        ];
    }
    public static function __callStatic(string $method, array $arguments)
    {
        $httpMethod = strtoupper($method);

        if (!array_key_exists($httpMethod, static::$routes)) {
            throw new \BadMethodCallException("HTTP method {$httpMethod} is not supported.");
        }

        if (count($arguments) === 2) {
            [$uri, $controller] = $arguments;
            $middleware = [];
        } else {
            [$uri, $controller, $middleware] = $arguments;
        }

        self::route($httpMethod, $uri, $controller, $middleware);
    }
    public static function resource(string $uri, string $controller, $middleware = [])
    {
        $routes = [
            ['GET', $uri, $controller . '@index', $middleware],
            ['POST', $uri, $controller . '@store', $middleware],
            ['GET', $uri . '/{id}', $controller . '@show', $middleware],
            ['PUT', $uri . '/{id}', $controller . '@update', $middleware],
            ['DELETE', $uri . '/{id}', $controller . '@destroy', $middleware],
        ];

        foreach ($routes as [$method, $routeUri, $controllerAction, $routeMiddleware]) {
            self::route($method, $routeUri, $controllerAction, $routeMiddleware);
        }
    }

    protected function executeMiddleware($middleware, $params)
    {
        if (is_string($middleware)) {
            $middlewareClass = "App\\Middleware\\{$middleware}";
            if (!class_exists($middlewareClass)) {
                throw new \Exception("Middleware class {$middlewareClass} not found");
            }

            $middlewareInstance = new $middlewareClass;
            return $middlewareInstance->handle(['params' => $params], function ($request) {
                return true;
            });
        }

        if (is_array($middleware)) {
            [$middlewareClass, $options] = $middleware;
            $middlewareClass = "App\\Middleware\\{$middlewareClass}";

            if (!class_exists($middlewareClass)) {
                throw new \Exception("Middleware class {$middlewareClass} not found");
            }

            $middlewareInstance = new $middlewareClass;
            return $middlewareInstance->handle(['params' => $params], function ($request) {
                return true;
            }, $options);
        }

        return true;
    }

    public function direct(string $uri, string $requestType): mixed
    {
        $params = [];
        $matchedRoute = null;
        $routeConfig = null;

        // Sort routes by specificity
        $sortedRoutes = static::$routes[$requestType];
        uksort($sortedRoutes, function ($a, $b) {
            $aParams = substr_count($a, '([^/]+)');
            $bParams = substr_count($b, '([^/]+)');

            if ($aParams !== $bParams) {
                return $aParams - $bParams;
            }

            return strlen($b) - strlen($a);
        });

        // Match against sorted routes
        foreach ($sortedRoutes as $route => $config) {
            $pattern = str_replace('/', '\/', $route);

            if (preg_match("/^{$pattern}$/", $uri, $matches)) {
                $matchedRoute = $route;
                $routeConfig = $config;
                unset($matches[0]);
                $params = array_values($matches);
                break;
            }
        }

        if ($matchedRoute === null) {
            throw new \Exception("Route {$requestType} /{$uri} does not exist");
        }

        // Execute middleware
        if (!empty($routeConfig['middleware'])) {
            foreach ($routeConfig['middleware'] as $middleware) {
                $result = $this->executeMiddleware($middleware, $params);
                if ($result !== true) {
                    return $result; // Return error response from middleware
                }
            }
        }

        $controller = $routeConfig['controller'];

        if (is_callable($controller)) {
            return $controller(...$params);
        }

        if (is_array($controller)) {
            return $this->callAction($params, ...$controller);
        }

        if (is_string($controller)) {
            [$class, $method] = explode('@', $controller, 2);
            if (empty($class) || empty($method)) {
                throw new \Exception("Invalid controller format: {$controller}");
            }
            return $this->callAction($params, $class, $method);
        }

        throw new \Exception("Invalid controller type for route {$requestType} /{$uri}");
    }
}
