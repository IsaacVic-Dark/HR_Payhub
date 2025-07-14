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

    public static function resource(string $uri, string $class) {
        if (str_contains($class, '@')) {
            static::get($uri, "{$class}@index");
            static::post($uri, "{$class}@create");
            static::get("$uri/{id}", "{$class}@show");
            static::put("$uri/update/{id}", "{$class}@update");
            static::delete("$uri/delete/{id}", "{$class}@delete");
        } elseif (str_contains($class, '\\')) {
            static::get($uri, [$class, 'index']);
            static::post($uri, [$class, 'create']);
            static::get("$uri/{id}", [$class, 'show']);
            static::put("$uri/update/{id}", [$class, 'update']);
            static::delete("$uri/delete/{id}", [$class, 'delete']);
        } else {
            trigger_error("Unrecognized route format {$uri} {$class}", E_USER_ERROR);
        }
    }

    public static function __callStatic(string $method, array $arguments) {
        $httpMethod = strtoupper($method);

        if (!array_key_exists($httpMethod, static::$routes)) {
            throw new \BadMethodCallException("HTTP method {$httpMethod} is not supported.");
        }

        [$uri, $controller] = $arguments;

        $uri = self::$prefix ? self::$prefix . '/' . trim($uri, '/') : trim($uri, '/');

        // Transform URI for regex matching
        $uri = preg_replace('/{[^}]+}/', '(.+)', $uri);

        static::$routes[$httpMethod][$uri] = $controller;
    }

    public function direct(string $uri, string $requestType): mixed {
        $params = [];
        $matchedRoute = null;

        // dd(static::$routes);

        // regex routes
        foreach (static::$routes[$requestType] as $route => $controller) {
            if (preg_match("%^{$route}$%", $uri, $matches)) {
                $matchedRoute = $route;
                unset($matches[0]); // remove full match
                $params = array_values($matches);
                break;
            }
        }

        // no route matches
        if ($matchedRoute === null) {
            throw new \Exception("Route {$requestType} /{$uri} does not exist");
        }

        $controller = static::$routes[$requestType][$matchedRoute];

        if (is_callable($controller)) {
            return $controller(...$params);
        }

        if (is_array($controller)) {
            return $this->callAction($params, ...$controller);
        }

        // Controller@method)
        if (is_string($controller)) {
            [$class, $method] = explode('@', $controller, 2);
            if (empty($class) || empty($method)) {
                throw new \Exception("Invalid controller format: {$controller}");
            }
            return $this->callAction($params, $class, $method);
        }

        throw new \Exception("Invalid controller type for route {$requestType} /{$uri}");
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
