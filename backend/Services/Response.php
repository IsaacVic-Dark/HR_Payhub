<?php
namespace App\Services;

class Response {
    private static ?self $instance = null;

    public function __construct() {
        static::$instance = $this;
    }

    public static function instance(): self {
        return static::$instance ??= new self();
    }

    public function header(string $key, string $value): self {
        header("$key: $value");
        return $this;
    }

    public function withHeaders(array $headers): self {
        foreach ($headers as $key => $value) {
            $this->header($key, $value);
        }
        return $this;
    }

    public function cookie(string $name, string $value, int $minutes, string $path = '/', string $domain = '', bool $secure = false, bool $httpOnly = true): self {
        setcookie($name, $value, time() + ($minutes * 60), $path, $domain, $secure, $httpOnly);
        return $this;
    }

    public function withoutCookie(string $name): self {
        // remove the cookie by setting its expiration time in the past
        setcookie($name, '', time() - 3600);
        return $this;
    }

    /**
     * Render a view. Looks for a plain PHP template under resources/views,
     * e.g. view('users.show') => resources/views/users/show.php,
     * with $data extracted into scope.
     */
    public function view(string $view, array $data = [], int $status = 200): self {
        http_response_code($status);
        //todo: implement a view rendering system, for now just return the data as json
        throw new \InvalidArgumentException("View rendering not implemented. Requested view: $view");
    }

    public function json(array $data, int $status = 200): self {
        header('Content-Type: application/json');
        http_response_code($status);
        echo json_encode($data);
        return $this;
    }

    
    public function download(string $path, string $name = '', array $headers = []): self {
        if (!file_exists($path)) {
            http_response_code(404);
            echo "File not found.";
            return $this;
        }

        $name = $name ?: basename($path);
        header('Content-Description: File Transfer');
        header('Content-Type: application/octet-stream');
        header("Content-Disposition: attachment; filename=\"$name\"");
        header('Expires: 0');
        header('Cache-Control: must-revalidate');
        header('Pragma: public');
        header('Content-Length: ' . filesize($path));

        foreach ($headers as $key => $value) {
            header("$key: $value");
        }

        readfile($path);
        return $this;
    }

    //Sometimes you may wish to turn the string response of a given operation into a downloadable 
    // response without having to write the contents of the operation to disk. 
    // You may use the streamDownload method in this scenario. 
    // This method accepts a callback, file name, and an optional array of headers as its arguments
    public function streamDownload(callable $callback, string $name, array $headers = []): self {
        header('Content-Description: File Transfer');
        header('Content-Type: application/octet-stream');
        header("Content-Disposition: attachment; filename=\"$name\"");
        header('Expires: 0');
        header('Cache-Control: must-revalidate');
        header('Pragma: public');

        foreach ($headers as $key => $value) {
            header("$key: $value");
        }

        call_user_func($callback);
        return $this;
    }

    /**
     * Stream a JSON-encodable value in chunks rather than echoing the whole
     * encoded string at once. Useful for large arrays/objects where you want
     * to start flushing bytes to the client early.
     */
    public function streamJson(array $data, int $status = 200, int $chunkSize = 8192): self {
        header('Content-Type: application/json');
        http_response_code($status);

        // Disable output buffering/compression that would defeat streaming.
        while (ob_get_level() > 0) {
            ob_end_flush();
        }

        $json = json_encode($data);

        if ($json === false) {
            http_response_code(500);
            echo json_encode(['error' => 'Failed to encode JSON: ' . json_last_error_msg()]);
            return $this;
        }

        foreach (str_split($json, $chunkSize) as $chunk) {
            echo $chunk;
            if (function_exists('ob_flush')) {
                @ob_flush();
            }
            flush();
        }

        return $this;
    }

    public function eventStream(callable $generator): self {
        header('Content-Type: text/event-stream');
        header('Cache-Control: no-cache');
        header('Connection: keep-alive');

        foreach ($generator() as $data) {
            echo "data: " . json_encode($data) . "\n\n";
            ob_flush();
            flush();
        }

        return $this;
    }

    //The file method may be used to display a file, such as an image or PDF, directly in the user's browser instead of initiating a download. T
    // this method accepts the path to the file as its first argument and an array of headers as its second argument:
    public function file(string $path, array $headers = []): self {
        if (!file_exists($path)) {
            http_response_code(404);
            echo "File not found.";
            return $this;
        }

        $mimeType = mime_content_type($path);
        header("Content-Type: $mimeType");
        foreach ($headers as $key => $value) {
            header("$key: $value");
        }

        readfile($path);
        return $this;
    }

    public function redirect(string $url, int $status = 302): self {
        http_response_code($status);
        header("Location: $url");
        return $this;
    }

    public function status(int $status): self {
        http_response_code($status);
        return $this;
    }

    public function noContent(int $status = 204): self {
        http_response_code($status);
        return $this;
    }

    public function text(string $content, int $status = 200): self {
        header('Content-Type: text/plain; charset=UTF-8');
        http_response_code($status);
        echo $content;
        return $this;
    }

    public function html(string $content, int $status = 200): self {
        header('Content-Type: text/html; charset=UTF-8');
        http_response_code($status);
        echo $content;
        return $this;
    }
}