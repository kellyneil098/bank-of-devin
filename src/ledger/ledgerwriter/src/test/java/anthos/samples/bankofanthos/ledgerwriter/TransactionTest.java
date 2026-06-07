/*
 * Copyright 2020, Google LLC.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package anthos.samples.bankofanthos.ledgerwriter;

import java.lang.reflect.Field;
import java.util.Date;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;

class TransactionTest {

    private Transaction transaction;

    private static final String FROM_ACCOUNT_NUM = "1234567890";
    private static final String FROM_ROUTING_NUM = "123456789";
    private static final String TO_ACCOUNT_NUM = "5678901234";
    private static final String TO_ROUTING_NUM = "567891234";
    private static final Integer AMOUNT = 3755;
    private static final String REQUEST_UUID = "01234567-89ab-cdef-0123-456789abcdef";

    @BeforeEach
    void setUp() {
        transaction = new Transaction();
    }

    /**
     * Sets a private field on the given object using reflection, since
     * {@link Transaction} has no setters.
     */
    private static void setField(Object target, String fieldName, Object value)
            throws ReflectiveOperationException {
        Field field = Transaction.class.getDeclaredField(fieldName);
        field.setAccessible(true);
        field.set(target, value);
    }

    @Test
    @DisplayName("Given requestUuid is null, getRequestUuid returns empty string")
    void getRequestUuid_ReturnsEmptyString_WhenUuidIsNull() {
        // Given a freshly constructed transaction (requestUuid defaults to null)

        // When
        String result = transaction.getRequestUuid();

        // Then
        assertEquals("", result);
    }

    @Test
    @DisplayName("Given requestUuid is set, getRequestUuid returns the uuid value")
    void getRequestUuid_ReturnsUuid_WhenUuidIsSet() throws Exception {
        // Given
        setField(transaction, "requestUuid", REQUEST_UUID);

        // When
        String result = transaction.getRequestUuid();

        // Then
        assertEquals(REQUEST_UUID, result);
    }

    @Test
    @DisplayName("Given a normal transaction, toString formats amount as dollars")
    void toString_FormatsAmountAsDollars_ForNormalTransaction() throws Exception {
        // Given
        setField(transaction, "fromAccountNum", FROM_ACCOUNT_NUM);
        setField(transaction, "toAccountNum", TO_ACCOUNT_NUM);
        setField(transaction, "amount", AMOUNT);

        // When
        String result = transaction.toString();

        // Then
        assertEquals(FROM_ACCOUNT_NUM + "->$37.55->" + TO_ACCOUNT_NUM, result);
    }

    @Test
    @DisplayName("Given a zero amount, toString formats it as $0.00")
    void toString_FormatsZeroAmount() throws Exception {
        // Given
        setField(transaction, "fromAccountNum", FROM_ACCOUNT_NUM);
        setField(transaction, "toAccountNum", TO_ACCOUNT_NUM);
        setField(transaction, "amount", 0);

        // When
        String result = transaction.toString();

        // Then
        assertEquals(FROM_ACCOUNT_NUM + "->$0.00->" + TO_ACCOUNT_NUM, result);
    }

    @Test
    @DisplayName("Given a large amount, toString formats it with two decimals")
    void toString_FormatsLargeAmount() throws Exception {
        // Given
        setField(transaction, "fromAccountNum", FROM_ACCOUNT_NUM);
        setField(transaction, "toAccountNum", TO_ACCOUNT_NUM);
        setField(transaction, "amount", Integer.MAX_VALUE);

        // When
        String result = transaction.toString();

        // Then
        // Integer.MAX_VALUE (2147483647) / 100.0 == 21474836.47
        assertEquals(FROM_ACCOUNT_NUM + "->$21474836.47->" + TO_ACCOUNT_NUM,
                result);
    }

    @Test
    @DisplayName("Given a single-cent amount, toString pads the decimals")
    void toString_PadsSingleCentAmount() throws Exception {
        // Given
        setField(transaction, "fromAccountNum", FROM_ACCOUNT_NUM);
        setField(transaction, "toAccountNum", TO_ACCOUNT_NUM);
        setField(transaction, "amount", 1);

        // When
        String result = transaction.toString();

        // Then
        assertEquals(FROM_ACCOUNT_NUM + "->$0.01->" + TO_ACCOUNT_NUM, result);
    }

    @Test
    @DisplayName("Given all fields are set, every getter returns its value")
    void getters_ReturnAssignedValues() throws Exception {
        // Given
        Date timestamp = new Date();
        setField(transaction, "transactionId", 42L);
        setField(transaction, "fromAccountNum", FROM_ACCOUNT_NUM);
        setField(transaction, "fromRoutingNum", FROM_ROUTING_NUM);
        setField(transaction, "toAccountNum", TO_ACCOUNT_NUM);
        setField(transaction, "toRoutingNum", TO_ROUTING_NUM);
        setField(transaction, "amount", AMOUNT);
        setField(transaction, "timestamp", timestamp);
        setField(transaction, "requestUuid", REQUEST_UUID);

        // When, Then
        assertEquals(42L, transaction.getTransactionId());
        assertEquals(FROM_ACCOUNT_NUM, transaction.getFromAccountNum());
        assertEquals(FROM_ROUTING_NUM, transaction.getFromRoutingNum());
        assertEquals(TO_ACCOUNT_NUM, transaction.getToAccountNum());
        assertEquals(TO_ROUTING_NUM, transaction.getToRoutingNum());
        assertEquals(AMOUNT, transaction.getAmount());
        assertEquals(REQUEST_UUID, transaction.getRequestUuid());
    }
}
