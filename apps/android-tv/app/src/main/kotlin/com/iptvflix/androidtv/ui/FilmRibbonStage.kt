package com.iptvflix.androidtv.ui

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.withTransform
import androidx.compose.ui.res.imageResource
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.IntSize
import com.iptvflix.androidtv.R
import kotlin.math.min
import kotlin.math.roundToInt
import kotlin.math.sin

private val LogoRed = Color(0xFFFB313A)

/**
 * Ribbons unroll one after another from the edges, then coil in sequence
 * into the real brand mark (soft settle, not a hard swap).
 */
@Composable
fun FilmRibbonStage(
    unroll: Float,
    coil: Float,
    modifier: Modifier = Modifier,
    color: Color = LogoRed,
) {
    val u = unroll.coerceIn(0f, 1f)
    val c = coil.coerceIn(0f, 1f)
    val mark = ImageBitmap.imageResource(id = R.drawable.iptvflix_logo_mark)

    Canvas(modifier = modifier.fillMaxSize()) {
        val w = size.width
        val h = size.height
        val cx = w / 2f
        val cy = h / 2f

        val ribbonH = min(w, h) * 0.048f
        // Stop short of the centered "IPTVFlix" pocket so no bar crosses the word.
        val textPocket = w * 0.26f
        val maxReach = (cx - textPocket).coerceAtLeast(w * 0.18f)

        // Staggered local progress so each ribbon reads as its own motion.
        val u0 = stagger(u, start = 0.00f, end = 0.72f)
        val u1 = stagger(u, start = 0.10f, end = 0.82f)
        val u2 = stagger(u, start = 0.20f, end = 0.90f)
        val u3 = stagger(u, start = 0.28f, end = 1.00f)

        val c0 = stagger(c, start = 0.00f, end = 0.68f)
        val c1 = stagger(c, start = 0.08f, end = 0.74f)
        val c2 = stagger(c, start = 0.16f, end = 0.80f)
        val c3 = stagger(c, start = 0.24f, end = 0.86f)

        // Frame around the word: above / below only — never through mid-text (y≈0.48).
        val leftRibbon = UnrollState(0f, h * 0.34f, maxReach * u0, ribbonH, vertical = false)
        val rightRibbon = UnrollState(
            x = w - maxReach * u1,
            y = h * 0.34f,
            length = maxReach * u1,
            thickness = ribbonH * 0.95f,
            vertical = false,
        )
        val leftRibbon2 = UnrollState(0f, h * 0.62f, maxReach * 0.92f * u2, ribbonH * 0.9f, vertical = false)
        // Vertical from top, stops above the wordmark.
        val topRibbon = UnrollState(
            x = cx - ribbonH * 0.44f,
            y = 0f,
            length = (h * 0.34f - ribbonH) * u3,
            thickness = ribbonH * 0.88f,
            vertical = true,
        )

        val logoS = min(w, h) * 0.42f
        val o = Offset(cx - logoS / 2f, cy - logoS / 2f)

        val strip = UnrollState(
            x = o.x + logoS * 0.28f,
            y = o.y + logoS * 0.22f,
            length = logoS * 0.56f,
            thickness = logoS * 0.105f,
            vertical = true,
        )
        val topArm = UnrollState(
            x = o.x + logoS * 0.38f,
            y = o.y + logoS * 0.30f,
            length = logoS * 0.38f,
            thickness = logoS * 0.11f,
            vertical = false,
            angledTip = true,
            tipUp = true,
        )
        val midArm = UnrollState(
            x = o.x + logoS * 0.44f,
            y = o.y + logoS * 0.54f,
            length = logoS * 0.32f,
            thickness = logoS * 0.11f,
            vertical = false,
            angledTip = true,
            tipUp = false,
        )
        val bodyStem = UnrollState(
            x = o.x + logoS * 0.44f,
            y = o.y + logoS * 0.48f,
            length = logoS * 0.30f,
            thickness = logoS * 0.10f,
            vertical = true,
        )

        // Cover morph imperfections: bring the real mark in mid-coil.
        val markAlpha = easeInOutSine(stagger(c, start = 0.58f, end = 0.92f))
        val ribbonFade = (1f - markAlpha).coerceIn(0f, 1f)

        if (ribbonFade > 0.02f) {
            drawMorphingRibbon(leftRibbon2, midArm, c0, color, sprockets = true, spinSign = 1f, alphaMul = ribbonFade)
            drawMorphingRibbon(rightRibbon, topArm, c1, color, sprockets = true, spinSign = -1f, alphaMul = ribbonFade)
            drawMorphingRibbon(leftRibbon, bodyStem, c2, color, sprockets = false, spinSign = 1f, alphaMul = ribbonFade)
            drawMorphingRibbon(topRibbon, strip, c3, color, sprockets = true, spinSign = -1f, alphaMul = ribbonFade)
        }

        if (markAlpha > 0.02f) {
            val dst = IntSize(logoS.roundToInt(), logoS.roundToInt())
            drawImage(
                image = mark,
                srcOffset = IntOffset.Zero,
                srcSize = IntSize(mark.width, mark.height),
                dstOffset = IntOffset(o.x.roundToInt(), o.y.roundToInt()),
                dstSize = dst,
                alpha = markAlpha,
            )
        }
    }
}

/** Map global 0→1 into a delayed local 0→1 window (staggered sequences). */
private fun stagger(progress: Float, start: Float, end: Float): Float {
    val span = (end - start).coerceAtLeast(0.001f)
    return ((progress - start) / span).coerceIn(0f, 1f)
}

private data class UnrollState(
    val x: Float,
    val y: Float,
    val length: Float,
    val thickness: Float,
    val vertical: Boolean,
    val angledTip: Boolean = false,
    val tipUp: Boolean = true,
)

private fun DrawScope.drawMorphingRibbon(
    start: UnrollState,
    end: UnrollState,
    coil: Float,
    color: Color,
    sprockets: Boolean,
    spinSign: Float,
    alphaMul: Float = 1f,
) {
    if (start.length <= 1f && coil <= 0f) return
    // Smoothstep coil — no snap in the middle
    val e = easeInOutSine(coil.coerceIn(0f, 1f))
    // Gentle wrap that eases out so the end pose is stable
    val spin = sin(e * Math.PI.toFloat()) * 28f * spinSign * (1f - e) * (1f - e)

    val x = lerp(start.x, end.x, e)
    val y = lerp(start.y, end.y, e)
    val len = lerp(start.length.coerceAtLeast(1f), end.length, e)
    val thick = lerp(start.thickness, end.thickness, e)
    val vertical = if (e > 0.55f) end.vertical else start.vertical
    val tip = end.angledTip && e > 0.40f
    val tipAmt = if (tip) ((e - 0.40f) / 0.60f).coerceIn(0f, 1f) else 0f
    val alpha = alphaMul.coerceIn(0f, 1f)

    if (len <= 1f || thick <= 1f || alpha <= 0.01f) return

    val pivot = if (vertical) Offset(x + thick / 2f, y + len / 2f) else Offset(x + len / 2f, y)

    withTransform({
        rotate(spin, pivot = pivot)
    }) {
        if (vertical) {
            drawRoundRect(
                color = color.copy(alpha = alpha),
                topLeft = Offset(x, y),
                size = Size(thick, len),
                cornerRadius = CornerRadius(thick * 0.04f),
            )
            if (sprockets) {
                drawSprockets(vertical = true, x = x, y = y, length = len, thickness = thick, alpha = alpha)
            }
        } else if (tipAmt > 0f) {
            val tipLen = len * 0.14f * tipAmt
            val top = y - thick / 2f
            val path = Path().apply {
                if (end.tipUp) {
                    moveTo(x, top)
                    lineTo(x + len, top)
                    lineTo(x + len + tipLen, top - thick * 0.08f)
                    lineTo(x + len * 0.12f, top + thick)
                    lineTo(x, top + thick)
                } else {
                    moveTo(x, top)
                    lineTo(x + len * 0.12f, top)
                    lineTo(x + len + tipLen, top + thick * 1.08f)
                    lineTo(x + len, top + thick)
                    lineTo(x, top + thick)
                }
                close()
            }
            drawPath(path, color = color.copy(alpha = alpha))
            if (sprockets && tipAmt < 0.85f) {
                drawSprockets(
                    vertical = false,
                    x = x,
                    y = top,
                    length = len * (1f - tipAmt * 0.3f),
                    thickness = thick,
                    alpha = alpha * (1f - tipAmt),
                )
            }
        } else {
            drawRoundRect(
                color = color.copy(alpha = alpha),
                topLeft = Offset(x, y - thick / 2f),
                size = Size(len, thick),
                cornerRadius = CornerRadius(thick * 0.18f),
            )
            if (sprockets) {
                drawSprockets(
                    vertical = false,
                    x = x,
                    y = y - thick / 2f,
                    length = len,
                    thickness = thick,
                    alpha = alpha,
                )
            }
        }
    }
}

private fun DrawScope.drawSprockets(
    vertical: Boolean,
    x: Float,
    y: Float,
    length: Float,
    thickness: Float,
    alpha: Float,
) {
    val hole = thickness * 0.34f
    val gap = hole * 0.75f
    val count = ((length - gap) / (hole + gap)).toInt().coerceIn(0, 28)
    val a = alpha.coerceIn(0f, 1f)
    for (i in 0 until count) {
        val along = gap + i * (hole + gap)
        if (along + hole > length - gap * 0.2f) break
        val topLeft = if (vertical) {
            Offset(x + (thickness - hole) / 2f, y + along)
        } else {
            Offset(x + along, y + (thickness - hole) / 2f)
        }
        drawRoundRect(
            color = Color(0xFF050508).copy(alpha = a),
            topLeft = topLeft,
            size = Size(hole, hole),
            cornerRadius = CornerRadius(hole * 0.12f),
        )
    }
}

private fun lerp(a: Float, b: Float, t: Float): Float = a + (b - a) * t.coerceIn(0f, 1f)

private fun easeInOutSine(t: Float): Float {
    val x = t.coerceIn(0f, 1f)
    return (-0.5f * (kotlin.math.cos(Math.PI.toFloat() * x) - 1f))
}
