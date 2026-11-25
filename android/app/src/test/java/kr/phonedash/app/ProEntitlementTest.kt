package kr.phonedash.app

import com.android.billingclient.api.BillingClient.BillingResponseCode
import com.android.billingclient.api.Purchase.PurchaseState
import kr.phonedash.app.ProEntitlement.Owned
import kr.phonedash.app.ProEntitlement.State
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class ProEntitlementTest {
    private val paid = Owned(PurchaseState.PURCHASED, acknowledged = true)
    private val paidNew = Owned(PurchaseState.PURCHASED, acknowledged = false)
    private val pending = Owned(PurchaseState.PENDING, acknowledged = false)

    @Test
    fun aPaidPurchaseUnlocksPro() {
        assertEquals(State.PRO, ProEntitlement.fromOwned(listOf(paid)))
        assertEquals(State.PRO, ProEntitlement.fromOwned(listOf(pending, paidNew)))
    }

    @Test
    fun aPaymentStillOnItsWayIsPendingNotPro() {
        assertEquals(State.PENDING, ProEntitlement.fromOwned(listOf(pending)))
    }

    @Test
    fun noPurchaseOrARefundedOneIsFree() {
        // a refunded purchase is no longer in Play's list
        assertEquals(State.FREE, ProEntitlement.fromOwned(emptyList()))
        assertEquals(State.FREE, ProEntitlement.fromOwned(listOf(Owned(PurchaseState.UNSPECIFIED_STATE, false))))
    }

    @Test
    fun aFinishedPurchaseNeverTakesProAway() {
        assertEquals(State.PRO, ProEntitlement.afterUpdate(State.PRO, emptyList()))
        assertEquals(State.PRO, ProEntitlement.afterUpdate(State.PRO, listOf(pending)))
        assertEquals(State.PRO, ProEntitlement.afterUpdate(State.FREE, listOf(paidNew)))
        assertEquals(State.PENDING, ProEntitlement.afterUpdate(State.FREE, listOf(pending)))
        assertEquals(State.PRO, ProEntitlement.afterUpdate(State.PENDING, listOf(paidNew)))
        assertEquals(State.FREE, ProEntitlement.afterUpdate(State.FREE, emptyList()))
    }

    @Test
    fun onlyPaidUnacknowledgedPurchasesAreAcknowledged() {
        assertTrue(ProEntitlement.needsAcknowledging(paidNew))
        assertFalse(ProEntitlement.needsAcknowledging(paid))
        // the three days start when the payment arrives, not while it is pending
        assertFalse(ProEntitlement.needsAcknowledging(pending))
    }

    @Test
    fun onlyASettledAnswerIsKept() {
        assertEquals(State.PRO, ProEntitlement.parse("PRO"))
        assertEquals(State.FREE, ProEntitlement.parse("FREE"))
        assertEquals(State.FREE, ProEntitlement.parse("PENDING"))
        assertEquals(State.FREE, ProEntitlement.parse(null))
        assertEquals(State.FREE, ProEntitlement.parse("garbage"))
    }

    @Test
    fun playAnswersBecomeShortReasonsForThePanel() {
        assertEquals("", ProEntitlement.problem(BillingResponseCode.OK))
        assertEquals("", ProEntitlement.problem(BillingResponseCode.USER_CANCELED))
        assertEquals("play", ProEntitlement.problem(BillingResponseCode.BILLING_UNAVAILABLE))
        assertEquals("network", ProEntitlement.problem(BillingResponseCode.SERVICE_UNAVAILABLE))
        assertEquals("network", ProEntitlement.problem(BillingResponseCode.NETWORK_ERROR))
        assertEquals("product", ProEntitlement.problem(BillingResponseCode.ITEM_UNAVAILABLE))
        assertEquals("error", ProEntitlement.problem(BillingResponseCode.ERROR))
        assertEquals("product", ProEntitlement.problem(BillingResponseCode.DEVELOPER_ERROR))
        // a refused connection is not a missing product
        assertEquals("error", ProEntitlement.problem(BillingResponseCode.DEVELOPER_ERROR, setup = true))
        assertEquals("network", ProEntitlement.problem(BillingResponseCode.SERVICE_UNAVAILABLE, setup = true))
    }
}
