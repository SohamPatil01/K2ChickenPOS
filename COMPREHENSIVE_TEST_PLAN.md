# Comprehensive Test Plan - AzelaPOS System

## Test Execution Date: [Current Date]
## Tester: [Auto-Generated Test Plan]

---

## 1. AUTHENTICATION & AUTHORIZATION

### 1.1 Login Functionality
- [ ] **Test Case 1.1.1**: Login with valid Owner credentials
  - Phone: `9999999999`
  - Password: `owner123`
  - Expected: Successful login, redirect to POS/Dashboard
  - Verify: User info displayed in sidebar

- [ ] **Test Case 1.1.2**: Login with valid Manager credentials
  - Phone: `8888888888`
  - Password: `manager123`
  - Expected: Successful login, appropriate menu items visible

- [ ] **Test Case 1.1.3**: Login with valid Cashier credentials
  - Phone: `7777777777`
  - Password: `cashier123`
  - Expected: Successful login, limited menu items

- [ ] **Test Case 1.1.4**: Login with invalid credentials
  - Phone: `9999999999`
  - Password: `wrongpassword`
  - Expected: Error message displayed, stay on login page

- [ ] **Test Case 1.1.5**: Login with non-existent phone
  - Phone: `0000000000`
  - Password: `anypassword`
  - Expected: Error message displayed

- [ ] **Test Case 1.1.6**: Login with empty fields
  - Phone: (empty)
  - Password: (empty)
  - Expected: Form validation prevents submission

### 1.2 Logout Functionality
- [ ] **Test Case 1.2.1**: Logout from sidebar
  - Action: Click logout button
  - Expected: Redirected to login page, tokens cleared

- [ ] **Test Case 1.2.2**: Verify session cleared after logout
  - Action: Try accessing protected route after logout
  - Expected: Redirected to login

### 1.3 Role-Based Access Control
- [ ] **Test Case 1.3.1**: Cashier role - verify menu items
  - Expected: Can see Dashboard, POS, Cart, Customers
  - Expected: Cannot see Inventory, Stock Ledger, Wastage, Yield

- [ ] **Test Case 1.3.2**: Manager role - verify menu items
  - Expected: Can see all Cashier items + Inventory features

- [ ] **Test Case 1.3.3**: Owner role - verify menu items
  - Expected: Can see all menu items

---

## 2. POS (POINT OF SALE) FUNCTIONALITY

### 2.1 Product Loading & Display
- [ ] **Test Case 2.1.1**: Products load on page mount
  - Expected: Products displayed in grid
  - Verify: Product images, names, prices visible

- [ ] **Test Case 2.1.2**: Product categories load
  - Expected: Categories sidebar populated
  - Verify: "All Products" option available

- [ ] **Test Case 2.1.3**: Empty state handling
  - Condition: No products in system
  - Expected: Appropriate message displayed

### 2.2 Category Filtering
- [ ] **Test Case 2.2.1**: Filter by category
  - Action: Click a category
  - Expected: Only products from that category shown

- [ ] **Test Case 2.2.2**: "All Products" filter
  - Action: Click "All Products"
  - Expected: All products displayed

- [ ] **Test Case 2.2.3**: Category collapse/expand
  - Action: Click collapse button
  - Expected: Categories sidebar collapses
  - Action: Click expand button
  - Expected: Categories sidebar expands

### 2.3 Product Search
- [ ] **Test Case 2.3.1**: Search by product name
  - Input: Type product name
  - Expected: Matching products filtered

- [ ] **Test Case 2.3.2**: Search by SKU
  - Input: Type product SKU
  - Expected: Matching product found

- [ ] **Test Case 2.3.3**: Search with no results
  - Input: "NonExistentProduct123"
  - Expected: "No products found" message

- [ ] **Test Case 2.3.4**: Search bar expand/collapse
  - Action: Click search icon
  - Expected: Search bar expands
  - Action: Click outside or clear search
  - Expected: Search bar collapses

### 2.4 Adding Products to Cart
- [ ] **Test Case 2.4.1**: Add product by clicking
  - Action: Click product card
  - Expected: Manual entry modal opens with product pre-filled

- [ ] **Test Case 2.4.2**: Add product with KG unit
  - Product: Select KG product
  - Weight: Enter `2.5`
  - Rate: `100`
  - Expected: Item added to cart with correct calculation

- [ ] **Test Case 2.4.3**: Add product with PCS unit
  - Product: Select PCS product
  - Quantity: Enter `5`
  - Rate: `50`
  - Expected: Item added to cart with correct calculation

- [ ] **Test Case 2.4.4**: Cart animation on add
  - Action: Add product
  - Expected: Animation shows product flying to cart

- [ ] **Test Case 2.4.5**: Cart count updates
  - Action: Add multiple products
  - Expected: Cart badge shows correct count

### 2.5 Manual Item Entry
- [ ] **Test Case 2.5.1**: Add manual item with description
  - Description: "Custom Item"
  - Weight: `1.5`
  - Rate: `200`
  - Expected: Item added successfully

- [ ] **Test Case 2.5.2**: Add manual item with SKU lookup
  - SKU: Enter existing product SKU
  - Expected: Description and rate auto-filled

- [ ] **Test Case 2.5.3**: Validation - empty description
  - Description: (empty)
  - Expected: Error message, item not added

- [ ] **Test Case 2.5.4**: Validation - invalid weight
  - Weight: `0` or negative
  - Expected: Error message

- [ ] **Test Case 2.5.5**: Auto-calculation
  - Weight: `2`
  - Rate: `100`
  - Expected: Total auto-calculated as `200`

- [ ] **Test Case 2.5.6**: Auto-calculation reverse
  - Weight: `2`
  - Total: `200`
  - Expected: Rate auto-calculated as `100`

### 2.6 Price Override
- [ ] **Test Case 2.6.1**: Price locked product - override required
  - Product: Select price-locked product
  - Price: Enter different price
  - Expected: Price override modal appears

- [ ] **Test Case 2.6.2**: Price override with valid manager PIN
  - PIN: Enter correct manager PIN
  - Expected: Override approved, item added

- [ ] **Test Case 2.6.3**: Price override with invalid PIN
  - PIN: Enter wrong PIN
  - Expected: Error message, override denied

---

## 3. BARCODE SCANNING

### 3.1 Global Barcode Scanner
- [ ] **Test Case 3.1.1**: Scan barcode from any page
  - Action: Scan barcode while on Dashboard
  - Expected: Navigates to POS, adds product to cart

- [ ] **Test Case 3.1.2**: Scan valid SKU/PLU
  - Barcode: Valid product SKU
  - Expected: Product added to cart with default quantity

- [ ] **Test Case 3.1.3**: Scan scale barcode (if configured)
  - Barcode: Scale barcode format
  - Expected: Product added with weight/quantity from barcode

- [ ] **Test Case 3.1.4**: Scan invalid barcode
  - Barcode: "INVALID123"
  - Expected: Error notification, product not found

- [ ] **Test Case 3.1.5**: Barcode input field
  - Action: Type barcode in input field
  - Action: Press Enter
  - Expected: Product added to cart

- [ ] **Test Case 3.1.6**: Cart animation on barcode scan
  - Action: Scan barcode
  - Expected: Animation shows product flying to cart

### 3.2 Barcode Input Field
- [ ] **Test Case 3.2.1**: Focus on page load
  - Expected: Barcode input auto-focused

- [ ] **Test Case 3.2.2**: Submit barcode via form
  - Action: Enter barcode, press Enter
  - Expected: Product processed

---

## 4. CART MANAGEMENT

### 4.1 View Cart
- [ ] **Test Case 4.1.1**: Navigate to cart
  - Action: Click cart button
  - Expected: Cart page displays all items

- [ ] **Test Case 4.1.2**: Empty cart state
  - Condition: No items in cart
  - Expected: "Cart is empty" message displayed

- [ ] **Test Case 4.1.3**: Cart items display
  - Expected: Product name, quantity, rate, total visible
  - Expected: Tax information displayed if applicable

### 4.2 Cart Operations
- [ ] **Test Case 4.2.1**: Remove item from cart
  - Action: Click "Remove" button
  - Expected: Item removed, totals updated

- [ ] **Test Case 4.2.2**: Add item from cart page
  - Action: Click "Add Item" button
  - Expected: Manual entry modal opens

- [ ] **Test Case 4.2.3**: Back to POS
  - Action: Click "Back to POS"
  - Expected: Navigate to POS page

### 4.3 Customer Assignment
- [ ] **Test Case 4.3.1**: Enter customer phone
  - Phone: `9876543210`
  - Expected: Customer lookup triggered

- [ ] **Test Case 4.3.2**: Existing customer lookup
  - Phone: Existing customer phone
  - Expected: Customer name displayed

- [ ] **Test Case 4.3.3**: New customer
  - Phone: New phone number
  - Expected: "New customer" message displayed

### 4.4 Discount Application
- [ ] **Test Case 4.4.1**: Apply discount
  - Discount: Enter `50`
  - Expected: Grand total reduced by discount amount

- [ ] **Test Case 4.4.2**: Discount validation
  - Discount: Enter amount greater than subtotal
  - Expected: Grand total cannot be negative (handled appropriately)

- [ ] **Test Case 4.4.3**: Remove discount
  - Action: Set discount to `0`
  - Expected: Grand total recalculated

### 4.5 Totals Calculation
- [ ] **Test Case 4.5.1**: Subtotal calculation
  - Items: Add multiple items
  - Expected: Subtotal = sum of all line totals

- [ ] **Test Case 4.5.2**: Tax calculation
  - Items: Items with different tax rates
  - Expected: Tax = sum of (lineTotal * taxRate) for each item

- [ ] **Test Case 4.5.3**: Grand total calculation
  - Expected: Grand Total = Subtotal + Tax - Discount

---

## 5. PAYMENT PROCESSING

### 5.1 Payment Modal
- [ ] **Test Case 5.1.1**: Open payment modal
  - Action: Click "Pay" button
  - Expected: Payment modal opens with totals

- [ ] **Test Case 5.1.2**: Payment summary display
  - Expected: Subtotal, Tax, Discount, Grand Total visible

- [ ] **Test Case 5.1.3**: Payment method selection
  - Methods: CASH, CARD, UPI, ONLINE
  - Expected: All methods available

### 5.2 Payment Amount
- [ ] **Test Case 5.2.1**: Amount paid = grand total
  - Amount: Enter exact grand total
  - Expected: Change = 0

- [ ] **Test Case 5.2.2**: Amount paid > grand total
  - Amount: Enter more than grand total
  - Expected: Change calculated and displayed

- [ ] **Test Case 5.2.3**: Amount paid < grand total
  - Amount: Enter less than grand total
  - Expected: "Insufficient Amount" message, Pay button disabled

- [ ] **Test Case 5.2.4**: Auto-fill grand total
  - Expected: Amount paid field pre-filled with grand total

### 5.3 Payment Processing
- [ ] **Test Case 5.3.1**: Complete payment with CASH
  - Method: CASH
  - Amount: Grand total
  - Expected: Sale created, payment processed, cart cleared

- [ ] **Test Case 5.3.2**: Complete payment with CARD
  - Method: CARD
  - Expected: Payment processed successfully

- [ ] **Test Case 5.3.3**: Complete payment with UPI
  - Method: UPI
  - Expected: Payment processed successfully

- [ ] **Test Case 5.3.4**: Payment success notification
  - Expected: Success message displayed

- [ ] **Test Case 5.3.5**: Redirect after payment
  - Expected: Redirected to POS page after 1.5 seconds

### 5.4 Discount Approval Flow
- [ ] **Test Case 5.4.1**: Discount requires approval
  - Condition: Discount exceeds allowed limit
  - Expected: Sale created but pending approval
  - Expected: Redirected to discount approvals page

- [ ] **Test Case 5.4.2**: Discount approval notification
  - Expected: Info message about pending approval

### 5.5 Error Handling
- [ ] **Test Case 5.5.1**: Payment with empty cart
  - Condition: Cart is empty
  - Expected: Warning message, payment not processed

- [ ] **Test Case 5.5.2**: Payment API error
  - Condition: Simulate API error
  - Expected: Error message displayed, modal stays open

- [ ] **Test Case 5.5.3**: Network error handling
  - Condition: Offline mode
  - Expected: Appropriate error message

---

## 6. UI/UX FEATURES

### 6.1 Responsive Design
- [ ] **Test Case 6.1.1**: Mobile view (< 640px)
  - Expected: Layout adapts, sidebar becomes drawer
  - Expected: Product grid: 2 columns
  - Expected: Touch targets adequate size

- [ ] **Test Case 6.1.2**: Tablet view (768px - 1024px)
  - Expected: Layout adapts appropriately
  - Expected: Product grid: 3-4 columns

- [ ] **Test Case 6.1.3**: Desktop view (> 1024px)
  - Expected: Full layout with sidebar
  - Expected: Product grid: 5-7 columns

### 6.2 Sidebar Functionality
- [ ] **Test Case 6.2.1**: Sidebar collapse/expand
  - Action: Click collapse button
  - Expected: Sidebar collapses to icon-only
  - Action: Click expand button
  - Expected: Sidebar expands

- [ ] **Test Case 6.2.2**: Mobile menu toggle
  - Action: Click menu button on mobile
  - Expected: Sidebar slides in
  - Action: Click overlay
  - Expected: Sidebar slides out

- [ ] **Test Case 6.2.3**: Active menu item highlighting
  - Action: Navigate to different pages
  - Expected: Correct menu item highlighted

### 6.3 Animations
- [ ] **Test Case 6.3.1**: Cart animation
  - Action: Add product
  - Expected: Smooth animation to cart icon

- [ ] **Test Case 6.3.2**: Page transitions
  - Expected: Smooth fade-in animations

- [ ] **Test Case 6.3.3**: Product card hover effects
  - Expected: Hover effects work smoothly

### 6.4 Notifications
- [ ] **Test Case 6.4.1**: Success notification
  - Action: Complete successful operation
  - Expected: Green success notification appears

- [ ] **Test Case 6.4.2**: Error notification
  - Action: Trigger error
  - Expected: Red error notification appears

- [ ] **Test Case 6.4.3**: Notification auto-dismiss
  - Expected: Notifications dismiss after timeout

---

## 7. OFFLINE FUNCTIONALITY

### 7.1 Offline Detection
- [ ] **Test Case 7.1.1**: Offline indicator
  - Condition: Network disconnected
  - Expected: Offline indicator appears

- [ ] **Test Case 7.1.2**: Online detection
  - Condition: Network reconnected
  - Expected: Offline indicator disappears

### 7.2 Offline Cart
- [ ] **Test Case 7.2.1**: Add items offline
  - Condition: Offline mode
  - Action: Add products to cart
  - Expected: Items stored locally

- [ ] **Test Case 7.2.2**: Cart persistence
  - Action: Add items, refresh page
  - Expected: Cart items persist

---

## 8. EDGE CASES & ERROR HANDLING

### 8.1 Input Validation
- [ ] **Test Case 8.1.1**: Negative numbers
  - Input: Negative weight/quantity
  - Expected: Validation prevents or corrects

- [ ] **Test Case 8.1.2**: Very large numbers
  - Input: Extremely large values
  - Expected: Handled appropriately

- [ ] **Test Case 8.1.3**: Special characters
  - Input: Special characters in search
  - Expected: Handled safely

### 8.2 Data Edge Cases
- [ ] **Test Case 8.2.1**: Product with no image
  - Expected: Placeholder image displayed

- [ ] **Test Case 8.2.2**: Product with missing data
  - Expected: Graceful handling, no crashes

- [ ] **Test Case 8.2.3**: Empty product list
  - Expected: Appropriate empty state

### 8.3 Concurrent Operations
- [ ] **Test Case 8.3.1**: Multiple rapid additions
  - Action: Rapidly add multiple products
  - Expected: All items added correctly

- [ ] **Test Case 8.3.2**: Payment during item addition
  - Action: Add item while payment modal open
  - Expected: Handled appropriately

---

## 9. PERFORMANCE TESTS

### 9.1 Load Performance
- [ ] **Test Case 9.1.1**: Page load time
  - Expected: Page loads in < 3 seconds

- [ ] **Test Case 9.1.2**: Product grid rendering
  - Condition: 100+ products
  - Expected: Smooth scrolling, no lag

### 9.2 Memory Usage
- [ ] **Test Case 9.2.1**: Long session
  - Action: Use app for extended period
  - Expected: No memory leaks

---

## 10. INTEGRATION TESTS

### 10.1 API Integration
- [ ] **Test Case 10.1.1**: Products API
  - Expected: Products load from API

- [ ] **Test Case 10.1.2**: Sales API
  - Expected: Sales created successfully

- [ ] **Test Case 10.1.3**: Payment API
  - Expected: Payments processed successfully

### 10.2 Database Integration
- [ ] **Test Case 10.2.1**: Data persistence
  - Action: Create sale
  - Expected: Sale saved to database

- [ ] **Test Case 10.2.2**: Data retrieval
  - Expected: Historical data loads correctly

---

## TEST SUMMARY

### Total Test Cases: ~100+
### Critical Path Tests: 25
### Edge Case Tests: 15
### Performance Tests: 5

### Test Execution Notes:
- Execute tests in order
- Document any failures with screenshots
- Note browser/device used
- Record any unexpected behavior

---

## KNOWN ISSUES TO VERIFY

1. [ ] Payment amount validation
2. [ ] Barcode scanning timing
3. [ ] Offline sync behavior
4. [ ] Price override PIN validation
5. [ ] Discount approval flow

---

## TEST ENVIRONMENT

- Browser: [Chrome/Firefox/Safari]
- Device: [Desktop/Mobile/Tablet]
- OS: [Windows/Mac/Linux/iOS/Android]
- API URL: [Local/Staging/Production]
- Database: [Local/Cloud]

---

## SIGN-OFF

- [ ] All critical tests passed
- [ ] All edge cases handled
- [ ] Performance acceptable
- [ ] Ready for production

**Tester Signature:** _________________
**Date:** _________________

