package kr.phonedash.app

import com.android.billingclient.api.BillingClient.BillingResponseCode
import com.android.billingclient.api.Purchase.PurchaseState

/**
 * What the panel unlocks, worked out from Google Play's answers. Kept apart from [ProStore] (which talks to Play) so
 * the rules can be tested on the JVM without a Play Store.
 */
object ProEntitlement {
    enum class State { FREE, PENDING, PRO }

    /** The part of a Play purchase that matters here: [state] is a Purchase.PurchaseState value. */
    data class Owned(val state: Int, val acknowledged: Boolean)

    /**
     * Google Play's full list of this product's purchases (queryPurchasesAsync): Pro once one is paid for, "pending"
     * while a payment is still on its way (paid in cash at a shop, for example), free otherwise. A refunded or
     * cancelled purchase drops out of the list, which turns Pro off again.
     */
    fun fromOwned(owned: List<Owned>): State = when {
        owned.any { it.state == PurchaseState.PURCHASED } -> State.PRO
        owned.any { it.state == PurchaseState.PENDING } -> State.PENDING
        else -> State.FREE
    }

    /**
     * A purchase that has just finished (onPurchasesUpdated) only adds to what is known: it never takes Pro away, as
     * the update carries the new purchase alone, not the whole list.
     */
    fun afterUpdate(current: State, owned: List<Owned>): State = when {
        current == State.PRO -> State.PRO
        else -> fromOwned(owned).takeIf { it != State.FREE } ?: current
    }

    /** Paid purchases Play still waits to hear about: unacknowledged after three days, they are refunded. */
    fun needsAcknowledging(o: Owned): Boolean = o.state == PurchaseState.PURCHASED && !o.acknowledged

    /** The kept state, read back at start: only a settled answer (free or Pro) is kept. */
    fun parse(saved: String?): State = if (saved == State.PRO.name) State.PRO else State.FREE

    /**
     * Why Play could not help, in the panel's words: "play" (no Play Store, no Google account, or a copy of the app
     * that did not come from Play), "network", "product" (the product is not on sale yet) or "error".
     * Empty for answers that are not a problem. [setup]: the answer to connecting, where DEVELOPER_ERROR means the
     * connection itself was refused (one already on its way, for example), not that the product is missing.
     */
    fun problem(code: Int, setup: Boolean = false): String = when (code) {
        BillingResponseCode.OK, BillingResponseCode.USER_CANCELED, BillingResponseCode.ITEM_ALREADY_OWNED -> ""
        BillingResponseCode.BILLING_UNAVAILABLE, BillingResponseCode.FEATURE_NOT_SUPPORTED -> "play"
        BillingResponseCode.SERVICE_UNAVAILABLE, BillingResponseCode.SERVICE_DISCONNECTED, BillingResponseCode.NETWORK_ERROR -> "network"
        BillingResponseCode.DEVELOPER_ERROR -> if (setup) "error" else "product"
        BillingResponseCode.ITEM_UNAVAILABLE -> "product"
        else -> "error"
    }
}
