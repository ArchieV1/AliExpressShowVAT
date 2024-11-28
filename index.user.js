// ==UserScript==
// @name         Aliexpress show VAT
// @namespace    http://tampermonkey.net/
// @version      2024.11
// @description  Adds VAT to the prices shown on Aliexpress
// @author       ArchieV1
// @match        https://www.aliexpress.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=aliexpress.com
// @grant        none
// ==/UserScript==
'use strict';

// Edit these two to adjust to your local currency
// To support sites other than .com replace all ".com" with your url on this page
const VAT_RATE = 1.2; // 20%
const ALI_CURRENCY_SYMBOL = "￡"; // This is not the standard keyboard £


const RELOAD_TIME = 0.5; // Seconds
const EDITED_STYLE = "text-decoration: underline red;";

(function() {
    console.log("Adding event listener");
    document.addEventListener('keydown', function (event){
        if (event.key !== undefined){
            if (event.altKey && event.key === "c"){
                HandlePage();
            }
        }
    });

    console.log(`Updating page every ${RELOAD_TIME} seconds`);
    function handlePageLooper(){
        setTimeout(handlePageLooper, RELOAD_TIME * 1000)
        HandlePage();
    }
    handlePageLooper();
})();



// Calculate the new price
function increaseTotalPrice(price){
    // Expects in format 00.00
    return Math.round(price * VAT_RATE * 100) / 100;
}

// Say that the element has been updated
function setUpdatedStyle(element) {
    // Removes strikethrough
    element.style.cssText += EDITED_STYLE;
}

// The element has not been edited yet
function elementUnstyled(element) {
    return !element.style.cssText.includes(EDITED_STYLE)
}

// Updates the price of a single element
function increasePriceSingleElement(element) {
    const price = element.innerText.match(/[0-9.]+/)[0]; // Get price (digits and .)
    const textWithoutPrice = element.innerText.match(/[^0-9.]+/)[0] // Get text before cost. Will miss any text after

    const newPrice = increaseTotalPrice(price);

    element.innerText = `${textWithoutPrice}${newPrice}`
    setUpdatedStyle(element)
}

// Updates the price of the given element
// Updates the style of the element after update
// NOTE: Requires the price to be the text of the given element
function handleSingleElement(element) {
    try{
        if (element != null && elementUnstyled(element))
        {
            increasePriceSingleElement(element);
        }
    }
    catch (err) {
        console.warn("Failed to adjust price for following:");
        console.warn(element);
        console.warn(err)
    }
}

// Handles all elements matchingSelector in document
function handleSelector(selector) {
    for (let element of document.querySelectorAll(selector)){
        handleSingleElement(element)
    }
}

// Handles all elements containing className
function handleClass(className) {
    handleSelector(`[class*='${className}']`)
}

function HandlePage() {
    // Calculates changes depending on page type
    // Could probably just run them all on every page but that isn't very future-proof
    // And would make testing harder

    const ignoreURLs = [
        "/shoppingcart/",
        "aliexpress.com/p/order",
        "aliexpress.com/p/wallet-ui",
        "aliexpress.com/p/refund-dispute",
        "aliexpress.com/p/trade" // Checkout
    ]
    for (let url of ignoreURLs) {
        if (document.URL.includes(url)) {
            // Real money involved in this area so want to keep it certainly accurate
            return;
        }
    }

    // Wholesale
    if (document.URL.includes("/w/wholesale")){
        SearchPageHandler();
    }

    // Individual item
    if (document.URL.includes("/item/")){
        ItemPageHandler();
        SearchPageHandler();
    }
    // Home
    if (document.URL.match(/https:\/\/www\.aliexpress\.com\/[^\/]*/)[0] === document.URL){
        HomePageHandler();
        SearchPageHandler();
    }

    // Super deals
    if (document.URL.includes("/ssr/")){
        SuperDealsHandler();
    }

    // Bundle deal
    if (document.URL.includes("/gcp/")) {
        BundleDealHandler();
    }

    // Product type (Categories)
    if (document.URL.includes(".aliexpress.com/p/")) {
        SearchPageHandler();
        PopupHandler();
    }

    // Every page has the cart sidebar
    CartHandler()
}

function SearchPageHandler(){
    const cards = document.querySelectorAll("[class*='card-out-wrapper']")

    for (let card of cards){
        try{
            // Standard is: Name, NumSold, Price, Offer, Shipping
            // Sometimes:   Name,        , Price, Offer, Shipping

            // Assume sometimes one with NumSold/Rating div missing
            let multiPrice = card.querySelector("a > div:nth-child(2) > div:nth-child(2)");

            if (!multiPrice.innerText.includes(ALI_CURRENCY_SYMBOL)) {
                // We are working with a standard one
                multiPrice = card.querySelector("a > div:nth-child(2) > div:nth-child(3)");
            }

            if (!multiPrice.innerText.includes(ALI_CURRENCY_SYMBOL)) {
                // Just in case - Never seen
                multiPrice = card.querySelector("a > div:nth-child(2) > div:nth-child(4)");
            }

            const originalDiv = multiPrice.querySelector("div:nth-child(1)");
            const saleDiv = multiPrice.querySelector("div:nth-child(2)");

            for (let div of [saleDiv, originalDiv]) {
                try {
                    // Not sure sale will always be there
                    // Sometimes ad blocker blocks the children with price
                    if (div !== null && div.firstChild){
                        // Handle grabbing price in a single element (The non-sale price)
                        const salePriceElem = div.querySelector("span");
                        if (div.childElementCount === 1 && !salePriceElem.style.cssText.includes(EDITED_STYLE)){
                            increasePriceSingleElement(salePriceElem);
                        }
                        else{
                            // Handle price spread over a few spans
                            const poundsElem = div.querySelector("span:nth-child(2)");
                            const penceElem = div.querySelector("span:nth-child(4)");

                            if (poundsElem != null && elementUnstyled(poundsElem)){
                                // Does not always have the pence shown
                                let pence = 0;
                                if (penceElem != null) { pence = penceElem.innerText; }

                                const price = Number.parseFloat(`${poundsElem.innerText}.${pence}`)

                                const newPrice = increaseTotalPrice(price);

                                const newPounds = Math.floor(newPrice);
                                const newPence = Math.round((newPrice - newPounds) * 100);

                                poundsElem.innerText = newPounds;
                                setUpdatedStyle(poundsElem);

                                if (penceElem != null) {
                                    penceElem.innerText = newPence;
                                    setUpdatedStyle(penceElem);
                                }
                            }
                        }
                    }
                }
                catch (err) {
                    console.warn("Failed to adjust price for following:");
                    console.warn(div);
                    console.warn(err);
                }
            }
        }
        catch (err) {
            console.warn("Failed to read card");
            console.warn(card)
            console.warn(err);
        }
    }
}

function ItemPageHandler(){
    handleClass("price--current--");
    handleClass("price--originalText--");
}

function SuperDealsHandler() {
    // The infinite results at the bottom
    for (let element of document.querySelectorAll("[class*='aec-view bottom_container_']"))
    {
        handleSingleElement(element.querySelector("span")); // New price
        handleSingleElement(element.querySelector("[class*='ori_price_']")); // Old price
    }

    // The main deals at the top
    for (let element of document.querySelectorAll("[class*='ec-view price_infos_']"))
    {
        handleSingleElement(element.children[0]); // New price
        handleSingleElement(element.children[1]); // Old price
    }
}

function CartHandler() {
    // This is the sidebar cart NOT the main cart page
    handleClass("cart-summary-top");
    handleClass("cart-summary-bottom");

    handleClass("cart-product-price-text");
}

function HomePageHandler(){
    // "WARNING: The HomePage changes often and is likely to break"

    // Nov 2024
    // "Today's Deals"
    handleClass("minPrice");

    // Nov 2024
    // "Today's Deals"
    handleClass("oriMinPrice");

    // Nov 2024
    // "Aliexpress Business"
    handleClass("ItemCard--price-")

    // Nov 2024
    // "Aliexpress Business"
    handleClass("ItemCard--originalPrice-")

    // Nov 2024
    // Deals at the top
    handleSelector("[class*='card--priceWrap-'] > [class*='card--price--']")
}

function BundleDealHandler() {
    handleSelector("[class*='productContainer'] > div[id] > [class*='priceContainer'] > span:nth-child(1)"); // New price
    handleSelector("[class*='productContainer'] > div[id] > [class*='priceContainer'] > span:nth-child(2)"); // Old price

    handleClass("checkout-amount-summary");

    PopupHandler();
}

function PopupHandler() {
    handleClass("price--currentPriceText");
    handleClass("price--originalText--");
}