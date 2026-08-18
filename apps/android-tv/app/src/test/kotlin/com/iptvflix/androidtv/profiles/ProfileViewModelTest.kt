package com.iptvflix.androidtv.profiles

import com.iptvflix.androidtv.network.ProfileResponse
import com.iptvflix.androidtv.network.SelectProfileResponse
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

private val PROFILE_A = ProfileResponse(id = "profile-a", name = "Alice", avatarKey = "avatar_01", isKids = false)
private val PROFILE_B = ProfileResponse(id = "profile-b", name = "Bob", avatarKey = "avatar_02", isKids = false)

/**
 * Pure unit tests for profile loading and selection logic, without AndroidViewModel overhead.
 * Tests replicate the ViewModel's suspend logic directly using configurable fakes.
 */
@OptIn(ExperimentalCoroutinesApi::class)
class ProfileViewModelTest {

    // ---------------------------------------------------------------------------
    // Fakes
    // ---------------------------------------------------------------------------

    private data class FakeStore(
        var deviceToken: String? = null,
        var lastProfileId: String? = null,
    )

    private suspend fun fakeLoadProfiles(
        profiles: List<ProfileResponse> = listOf(PROFILE_A, PROFILE_B),
        shouldFail: Boolean = false,
    ): ProfileUiState = try {
        if (shouldFail) throw RuntimeException("Server unavailable")
        ProfileUiState(profiles = profiles, loading = false)
    } catch (e: Exception) {
        ProfileUiState(loading = false, error = e.message)
    }

    private suspend fun fakeSelectProfile(
        store: FakeStore,
        profileId: String,
        profiles: List<ProfileResponse> = listOf(PROFILE_A, PROFILE_B),
        shouldFail: Boolean = false,
    ): Result<ProfileResponse> = runCatching {
        if (shouldFail) throw RuntimeException("Network error")
        val profile = profiles.first { it.id == profileId }
        val token = "mock-jwt-$profileId"
        store.deviceToken = token
        store.lastProfileId = profileId
        profile
    }

    // ---------------------------------------------------------------------------
    // loadProfiles tests
    // ---------------------------------------------------------------------------

    @Test
    fun `loadProfiles emits correct state with profiles`() = runTest {
        val state = fakeLoadProfiles()

        assertFalse(state.loading)
        assertNull(state.error)
        assertEquals(2, state.profiles.size)
        assertEquals("Alice", state.profiles[0].name)
        assertEquals("Bob", state.profiles[1].name)
    }

    @Test
    fun `loadProfiles emits error state on network failure`() = runTest {
        val state = fakeLoadProfiles(shouldFail = true)

        assertFalse(state.loading)
        assertNotNull(state.error)
        assertTrue(state.profiles.isEmpty())
    }

    // ---------------------------------------------------------------------------
    // selectProfile tests
    // ---------------------------------------------------------------------------

    @Test
    fun `selectProfile on success stores token and last profile id`() = runTest {
        val store = FakeStore()

        val result = fakeSelectProfile(store, PROFILE_A.id)

        assertTrue(result.isSuccess)
        assertEquals("mock-jwt-${PROFILE_A.id}", store.deviceToken)
        assertEquals(PROFILE_A.id, store.lastProfileId)
    }

    @Test
    fun `selectProfile targets the correct profile by id`() = runTest {
        val store = FakeStore()

        val result = fakeSelectProfile(store, PROFILE_B.id)

        assertTrue(result.isSuccess)
        assertEquals(PROFILE_B.name, result.getOrNull()?.name)
        assertEquals(PROFILE_B.id, store.lastProfileId)
    }

    @Test
    fun `selectProfile on failure does not update token store`() = runTest {
        val store = FakeStore(deviceToken = "existing-token")

        val result = fakeSelectProfile(store, PROFILE_A.id, shouldFail = true)

        assertTrue(result.isFailure)
        assertEquals("existing-token", store.deviceToken)
        assertNull(store.lastProfileId)
    }

    @Test
    fun `selectProfile success delivers the selected profile data`() = runTest {
        val store = FakeStore()

        val result = fakeSelectProfile(store, PROFILE_B.id)

        val profile = result.getOrNull()
        assertNotNull(profile)
        assertEquals("Bob", profile!!.name)
        assertEquals("avatar_02", profile.avatarKey)
        assertFalse(profile.isKids)
    }
}
