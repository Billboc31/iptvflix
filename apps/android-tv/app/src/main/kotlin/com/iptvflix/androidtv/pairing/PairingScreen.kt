package com.iptvflix.androidtv.pairing

import android.graphics.Bitmap
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.tv.material3.Button
import androidx.tv.material3.CircularProgressIndicator
import androidx.tv.material3.Text
import com.google.zxing.BarcodeFormat
import com.google.zxing.MultiFormatWriter
import com.google.zxing.common.BitMatrix

@Composable
fun PairingScreen(
    onPaired: () -> Unit,
    vm: PairingViewModel = viewModel(),
) {
    val state by vm.uiState.collectAsState()

    LaunchedEffect(state) {
        if (state is PairingUiState.Approved) onPaired()
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFF1A1A2E)),
        contentAlignment = Alignment.Center,
    ) {
        when (val s = state) {
            is PairingUiState.Loading -> CircularProgressIndicator()
            is PairingUiState.ShowingCode -> PairingCodeContent(code = s.code, onRetry = null)
            is PairingUiState.Expired -> PairingCodeContent(code = "", onRetry = { vm.startPairing() })
            is PairingUiState.Error -> ErrorContent(message = s.message, onRetry = { vm.startPairing() })
            is PairingUiState.Approved -> CircularProgressIndicator()
        }
    }
}

@Composable
private fun PairingCodeContent(code: String, onRetry: (() -> Unit)?) {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
        modifier = Modifier.padding(32.dp),
    ) {
        if (onRetry != null) {
            Text("Code expired", color = Color.White, fontSize = 24.sp)
            Spacer(Modifier.height(16.dp))
            Button(onClick = onRetry) { Text("Request new code") }
        } else {
            Text(
                "Pair IPTVFlix",
                color = Color.White,
                fontSize = 28.sp,
                fontWeight = FontWeight.Bold,
            )
            Spacer(Modifier.height(8.dp))
            Text(
                "Open IPTVFlix on your phone or browser and enter the code below.",
                color = Color(0xFFAAAAAA),
                fontSize = 16.sp,
            )
            Spacer(Modifier.height(32.dp))
            QrCodeImage(value = code, size = 200)
            Spacer(Modifier.height(24.dp))
            Text(
                code,
                color = Color.White,
                fontSize = 48.sp,
                fontWeight = FontWeight.Bold,
                fontFamily = FontFamily.Monospace,
                letterSpacing = 8.sp,
            )
        }
    }
}

@Composable
private fun ErrorContent(message: String, onRetry: () -> Unit) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Text("Could not connect: $message", color = Color(0xFFFF6B6B), fontSize = 18.sp)
        Spacer(Modifier.height(16.dp))
        Button(onClick = onRetry) { Text("Retry") }
    }
}

@Composable
private fun QrCodeImage(value: String, size: Int) {
    val bitmap = remember(value) { generateQrBitmap(value, size) }
    if (bitmap != null) {
        Image(
            bitmap = bitmap.asImageBitmap(),
            contentDescription = "QR code for pairing",
            modifier = Modifier.size(size.dp),
        )
    }
}

private fun generateQrBitmap(content: String, sizePx: Int): Bitmap? = runCatching {
    val matrix: BitMatrix = MultiFormatWriter().encode(content, BarcodeFormat.QR_CODE, sizePx, sizePx)
    val bmp = Bitmap.createBitmap(sizePx, sizePx, Bitmap.Config.RGB_565)
    for (x in 0 until sizePx) {
        for (y in 0 until sizePx) {
            bmp.setPixel(x, y, if (matrix[x, y]) android.graphics.Color.BLACK else android.graphics.Color.WHITE)
        }
    }
    bmp
}.getOrNull()
