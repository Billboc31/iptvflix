package com.iptvflix.androidtv

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import com.iptvflix.androidtv.ui.IptvFlixTvTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            IptvFlixTvTheme {
                AppNavGraph()
            }
        }
    }
}
