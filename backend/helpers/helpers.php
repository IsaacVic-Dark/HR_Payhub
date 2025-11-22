<?php
// helpers.php (if not already exists)

if (!function_exists('responseJson')) {
    function responseJson($success, $data, $message = '', $code = 200) {
        http_response_code($code);
        header('Content-Type: application/json');
        
        $response = [
            'success' => $success,
            'data' => $data,
            'message' => $message,
            'timestamp' => time()
        ];
        
        echo json_encode($response);
        exit;
    }
}