<?php
include '../config/database.php';

$action = $_GET['action'] ?? '';
$data = json_decode(file_get_contents("php://input"), true);

if ($action == 'register') {
    $name = $data['name'];
    $user = $data['username'];
    $pin = $data['pin']; // Di production sebaiknya di-hash

    $sql = "INSERT INTO users (name, username, pin) VALUES ('$name', '$user', '$pin')";
    if (mysqli_query($conn, $sql)) {
        echo json_encode(["status" => "success", "message" => "Berhasil daftar"]);
    } else {
        echo json_encode(["status" => "error", "message" => "Username sudah ada"]);
    }
} 

elseif ($action == 'login') {
    $user = $data['username'];
    $pin = $data['pin'];

    $query = mysqli_query($conn, "SELECT * FROM users WHERE username='$user' AND pin='$pin'");
    $result = mysqli_fetch_assoc($query);

    if ($result) {
        echo json_encode(["status" => "success", "data" => $result]);
    } else {
        echo json_encode(["status" => "error", "message" => "Login gagal"]);
    }
}
elseif ($action == 'update_profile') {
    $id = $data['id']; // ID User yang mau diedit
    $name = $data['name'];
    $username = $data['username'];
    $pin = $data['pin'];

    // Cek username kembar (kecuali punya sendiri)
    $cek = mysqli_query($conn, "SELECT id FROM users WHERE username='$username' AND id != '$id'");
    if(mysqli_num_rows($cek) > 0){
        echo json_encode(["status" => "error", "message" => "Username sudah dipakai orang lain"]);
        exit;
    }

    // Update data
    $sql = "UPDATE users SET name='$name', username='$username', pin='$pin' WHERE id='$id'";
    if (mysqli_query($conn, $sql)) {
        // Ambil data terbaru buat update sesi login di HP
        $u = mysqli_fetch_assoc(mysqli_query($conn, "SELECT * FROM users WHERE id='$id'"));
        echo json_encode(["status" => "success", "data" => $u]);
    } else {
        echo json_encode(["status" => "error", "message" => "Gagal update"]);
    }
}
?>