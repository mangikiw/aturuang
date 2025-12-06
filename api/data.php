<?php
include '../config/database.php';

$action = $_GET['action'] ?? '';
$input = json_decode(file_get_contents("php://input"), true);

if ($action == 'save') {
    $user_id = $input['user_id'];
    $json = json_encode($input['data']); // Ubah object JS jadi string JSON buat disimpen

    // Cek apakah data user sudah ada?
    $check = mysqli_query($conn, "SELECT id FROM user_data WHERE user_id='$user_id'");
    
    if (mysqli_num_rows($check) > 0) {
        // Update
        $sql = "UPDATE user_data SET json_data='$json' WHERE user_id='$user_id'";
    } else {
        // Insert Baru
        $sql = "INSERT INTO user_data (user_id, json_data) VALUES ('$user_id', '$json')";
    }

    if(mysqli_query($conn, $sql)) echo json_encode(["status" => "success"]);
    else echo json_encode(["status" => "error"]);
}

elseif ($action == 'load') {
    $user_id = $_GET['user_id'];
    $query = mysqli_query($conn, "SELECT json_data FROM user_data WHERE user_id='$user_id'");
    $row = mysqli_fetch_assoc($query);

    if ($row && $row['json_data']) {
        echo json_encode(["status" => "success", "data" => json_decode($row['json_data'])]);
    } else {
        echo json_encode(["status" => "empty"]);
    }
}
?>