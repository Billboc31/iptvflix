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
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.tv.material3.Text
import com.google.zxing.BarcodeFormat
import com.google.zxing.MultiFormatWriter
import com.google.zxing.common.BitMatrix
import com.iptvflix.androidtv.ui.TvColors
import com.iptvflix.androidtv.ui.TvPrimaryButton

@Composable
fun PairingScreen(
    onPaired: () -> Unit,
    pairingKey: Int = 0,
    vm: PairingViewModel = viewModel(key = "pairing-$pairingKey"),
) {
    val state by vm.uiState.collectAsState()
    var hasNavigated by remember(pairingKey) { mutableStateOf(false) }

    LaunchedEffect(state) {
        if (state is PairingUiState.Approved && !hasNavigated) {
            hasNavigated = true
            onPaired()
        }
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(TvColors.Background),
        contentAlignment = Alignment.Center,
    ) {
        when (val s = state) {
            is PairingUiState.Loading -> {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text("Génération du code…", color = TvColors.TextPrimary, fontSize = 22.sp)
                }
            }
            is PairingUiState.ShowingCode -> PairingCodeContent(code = s.code, expired = false)
            is PairingUiState.Expired -> PairingCodeContent(code = "", expired = true, onRetry = { vm.startPairing() })
            is PairingUiState.Error -> ErrorContent(message = s.message, onRetry = { vm.startPairing() })
            is PairingUiState.Approved -> {
                Text("Appareil connecté !", color = TvColors.Success, fontSize = 22.sp)
            }
        }
    }
}

@Composable
private fun PairingCodeContent(
    code: String,
    expired: Boolean,
    onRetry: (() -> Unit)? = null,
) {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
        modifier = Modifier.padding(32.dp),
    ) {
        Text(
            "Connecter la TV",
            color = TvColors.Accent,
            fontSize = 40.sp,
            fontWeight = FontWeight.Bold,
        )
        Spacer(Modifier.height(12.dp))
        Text(
            if (expired) "Le code a expiré" else "Associez cet appareil à votre compte IPTVFlix",
            color = if (expired) TvColors.Warning else TvColors.TextSecondary,
            fontSize = 20.sp,
        )
        Spacer(Modifier.height(8.dp))
        if (!expired) {
            Text(
                "Sur votre téléphone ou navigateur : Paramètres → Appareils → Saisir le code",
                color = TvColors.TextMuted,
                fontSize = 16.sp,
            )
        }
        Spacer(Modifier.height(36.dp))

        if (expired && onRetry != null) {
            TvPrimaryButton(
                label = "Nouveau code",
                onClick = onRetry,
                requestInitialFocus = true,
            )
        } else if (code.isNotBlank()) {
            QrCodeImage(value = code, size = 200)
            Spacer(Modifier.height(28.dp))
            Text(
                code,
                color = TvColors.TextPrimary,
                fontSize = 52.sp,
                fontWeight = FontWeight.Bold,
                fontFamily = FontFamily.Monospace,
                letterSpacing = 10.sp,
            )
        }
    }
}

@Composable
private fun ErrorContent(message: String, onRetry: () -> Unit) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Text("Connexion impossible", color = TvColors.Error, fontSize = 26.sp, fontWeight = FontWeight.Bold)
        Spacer(Modifier.height(12.dp))
        Text(message, color = TvColors.TextSecondary, fontSize = 18.sp)
        Spacer(Modifier.height(28.dp))
        TvPrimaryButton(
            label = "Réessayer",
            onClick = onRetry,
            requestInitialFocus = true,
        )
    }
}

@Composable
private fun QrCodeImage(value: String, size: Int) {
    val bitmap = remember(value) { generateQrBitmap(value, size) }
    if (bitmap != null) {
        Image(
            bitmap = bitmap.asImageBitmap(),
            contentDescription = "QR code de jumelage",
            modifier = Modifier
                .size(size.dp)
                .background(Color.White)
                .padding(8.dp),
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
