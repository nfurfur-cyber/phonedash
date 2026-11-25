package kr.phonedash.app

import android.app.Activity
import android.content.Context
import android.util.Log
import com.android.billingclient.api.AcknowledgePurchaseParams
import com.android.billingclient.api.BillingClient
import com.android.billingclient.api.BillingClient.BillingResponseCode
import com.android.billingclient.api.BillingClientStateListener
import com.android.billingclient.api.BillingFlowParams
import com.android.billingclient.api.BillingResult
import com.android.billingclient.api.PendingPurchasesParams
import com.android.billingclient.api.ProductDetails
import com.android.billingclient.api.Purchase
import com.android.billingclient.api.PurchasesUpdatedListener
import com.android.billingclient.api.QueryProductDetailsParams
import com.android.billingclient.api.QueryPurchasesParams
import org.json.JSONObject

/**
 * PhoneDash Pro: a one-time in-app product ([PRODUCT]) bought through Google Play. It unlocks the panel's extra pages,
 * the colour themes and buttons past the free ones (the panel decides what is locked, see assets/www/pro.js).
 *
 * There is no server: Google Play's own purchase list is the record. It is read at start, whenever the app comes back
 * to the front (a pending payment may have gone through meanwhile) and on Restore. The last settled answer is kept, so
 * the panel stays Pro when Play cannot be reached. Every paid purchase is acknowledged, as Play refunds one that is not
 * acknowledged within three days.
 *
 * Changes go to [changed] as JSON: {"state":"free|pending|pro","price":"₩4,900","ready":true,"problem":""}.
 * Everything here runs on the main thread; the bridge reads [json] from its own thread.
 */
class ProStore(private val activity: Activity, private val changed: (String) -> Unit) : PurchasesUpdatedListener {
    private val prefs = activity.getSharedPreferences("pro", Context.MODE_PRIVATE)
    @Volatile private var state = ProEntitlement.parse(prefs.getString(KEY_STATE, null))
    @Volatile private var details: ProductDetails? = null
    @Volatile private var problem = ""
    private var connecting = false
    private var setUp = false // connected once: from then on enableAutoServiceReconnection reconnects by itself
    private var updates = 0 // purchases Play has reported through onPurchasesUpdated
    private var closed = false

    private val client: BillingClient = BillingClient.newBuilder(activity)
        .setListener(this)
        .enablePendingPurchases(PendingPurchasesParams.newBuilder().enableOneTimeProducts().build())
        .enableAutoServiceReconnection()
        .build()

    /** The product has loaded, so [buy] can open the payment sheet. */
    val ready: Boolean get() = details != null

    /** What the panel needs to know, as JSON. */
    fun json(): String = JSONObject()
        .put("state", state.name.lowercase())
        .put("price", details?.let { offer(it)?.formattedPrice } ?: "")
        .put("ready", details != null)
        .put("problem", problem)
        .toString()

    /** Connects to Play if needed, then reads the product (its price) and this account's purchases again. */
    fun refresh() {
        if (closed) return
        // once set up, a call made while Play is disconnected reconnects by itself (enableAutoServiceReconnection);
        // starting a second connection then would only be refused
        if (client.isReady || setUp) { loadProduct(); loadPurchases(); return }
        if (connecting) return
        connecting = true
        client.startConnection(object : BillingClientStateListener {
            override fun onBillingSetupFinished(result: BillingResult) = main {
                connecting = false
                if (result.responseCode == BillingResponseCode.OK) { setUp = true; loadProduct(); loadPurchases() } else fail("setup", result)
            }

            // enableAutoServiceReconnection: the next call reconnects by itself
            override fun onBillingServiceDisconnected() = main { connecting = false }
        })
    }

    /** Opens Google Play's payment sheet. False when the product has not loaded (no Play, offline, not on sale). */
    fun buy(): Boolean {
        val product = details ?: run { refresh(); return false }
        val params = BillingFlowParams.ProductDetailsParams.newBuilder().setProductDetails(product)
        offer(product)?.offerToken?.let { params.setOfferToken(it) }
        val result = client.launchBillingFlow(activity, BillingFlowParams.newBuilder().setProductDetailsParamsList(listOf(params.build())).build())
        when (result.responseCode) {
            BillingResponseCode.OK -> {}
            BillingResponseCode.ITEM_ALREADY_OWNED -> loadPurchases()
            else -> fail("buy", result)
        }
        return result.responseCode == BillingResponseCode.OK
    }

    fun close() {
        closed = true
        client.endConnection()
    }

    override fun onPurchasesUpdated(result: BillingResult, purchases: MutableList<Purchase>?) = main {
        when (result.responseCode) {
            BillingResponseCode.OK -> { updates++; settle(purchases.orEmpty(), complete = false) }
            BillingResponseCode.USER_CANCELED -> publish()
            BillingResponseCode.ITEM_ALREADY_OWNED -> loadPurchases()
            else -> fail("purchase", result)
        }
    }

    /** Read again on every refresh, so a changed price (or a launch discount that has ended) shows up. */
    private fun loadProduct() {
        val product = QueryProductDetailsParams.Product.newBuilder().setProductId(PRODUCT).setProductType(BillingClient.ProductType.INAPP).build()
        client.queryProductDetailsAsync(QueryProductDetailsParams.newBuilder().setProductList(listOf(product)).build()) { result, found ->
            main {
                val match = found.productDetailsList.firstOrNull { it.productId == PRODUCT }
                when {
                    result.responseCode == BillingResponseCode.OK && match != null -> { details = match; problem = ""; publish() }
                    // OK with nothing found: the product is not set up in Play Console, or no longer active
                    result.responseCode == BillingResponseCode.OK -> {
                        details = null
                        fail("product", BillingResult.newBuilder().setResponseCode(BillingResponseCode.ITEM_UNAVAILABLE).build())
                    }
                    // Play out of reach for a moment: the product read before still holds
                    details != null -> Log.w(TAG, "product: ${result.responseCode} ${result.debugMessage}")
                    else -> fail("product", result)
                }
            }
        }
    }

    private fun loadPurchases() {
        val asked = updates
        val params = QueryPurchasesParams.newBuilder().setProductType(BillingClient.ProductType.INAPP).build()
        client.queryPurchasesAsync(params) { result, purchases ->
            main {
                when {
                    result.responseCode != BillingResponseCode.OK -> fail("purchases", result)
                    // a purchase finished while this list was on its way and may be missing from it: ask again
                    asked != updates -> loadPurchases()
                    else -> settle(purchases, complete = true)
                }
            }
        }
    }

    /** [complete]: Play's whole list (it can take Pro away again); otherwise a purchase that has just finished. */
    private fun settle(purchases: List<Purchase>, complete: Boolean) {
        val mine = purchases.filter { PRODUCT in it.products }
        val owned = mine.map { ProEntitlement.Owned(it.purchaseState, it.isAcknowledged) }
        state = if (complete) ProEntitlement.fromOwned(owned) else ProEntitlement.afterUpdate(state, owned)
        if (details != null) problem = "" // Play answered and the product is known: an earlier network problem is over
        if (state != ProEntitlement.State.PENDING) prefs.edit().putString(KEY_STATE, state.name).apply()
        mine.filter { ProEntitlement.needsAcknowledging(ProEntitlement.Owned(it.purchaseState, it.isAcknowledged)) }.forEach(::acknowledge)
        publish()
    }

    private fun acknowledge(purchase: Purchase) {
        val params = AcknowledgePurchaseParams.newBuilder().setPurchaseToken(purchase.purchaseToken).build()
        // a failure is tried again with the next refresh (start, back to the front, Restore): Play allows three days
        client.acknowledgePurchase(params) { result -> if (result.responseCode != BillingResponseCode.OK) Log.w(TAG, "acknowledge: ${result.responseCode}") }
    }

    /** The cheapest offer Play shows this account (a launch discount, when there is one), or null. */
    private fun offer(product: ProductDetails): ProductDetails.OneTimePurchaseOfferDetails? =
        product.oneTimePurchaseOfferDetailsList?.minByOrNull { it.priceAmountMicros } ?: product.oneTimePurchaseOfferDetails

    private fun fail(step: String, result: BillingResult) {
        problem = ProEntitlement.problem(result.responseCode, setup = step == "setup")
        Log.w(TAG, "$step: ${result.responseCode} ${result.debugMessage}")
        publish()
    }

    private fun publish() { if (!closed) changed(json()) }

    private fun main(block: () -> Unit) { if (!closed) activity.runOnUiThread { if (!closed) block() } }

    companion object {
        /** The product's id in Play Console (Monetise › In-app products). */
        const val PRODUCT = "pro_lifetime"
        private const val KEY_STATE = "state"
        private const val TAG = "PhoneDashPro"
    }
}
