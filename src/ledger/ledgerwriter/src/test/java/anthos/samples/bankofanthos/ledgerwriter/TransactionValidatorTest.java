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

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.Mock;

import static anthos.samples.bankofanthos.ledgerwriter.ExceptionMessages.
        EXCEPTION_MESSAGE_INVALID_NUMBER;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.mockito.MockitoAnnotations.initMocks;

class TransactionValidatorTest {

    private TransactionValidator transactionValidator;

    @Mock
    private Transaction transaction;

    private static final String LOCAL_ROUTING_NUM = "123456789";
    private static final String AUTHED_ACCOUNT_NUM = "1234567890";
    private static final String VALID_ROUTING_NUM = "123456789";
    private static final int VALID_AMOUNT = 100;

    // Account numbers must be exactly 10 digits; routing numbers exactly 9.
    private static final String[] INVALID_NUMBERS = {
        "",            // empty
        "12345",       // too short
        "12345678901", // too long
        "12345abcde",  // non-numeric
        "123 456789",  // contains whitespace
    };

    @BeforeEach
    void setUp() {
        initMocks(this);
        transactionValidator = new TransactionValidator();
    }

    @Test
    @DisplayName("Given a transaction with an invalid account or routing "
            + "number, an IllegalArgumentException is thrown")
    void validateTransactionFailsWhenAccountOrRoutingNumberInvalid() {
        for (String invalid : INVALID_NUMBERS) {
            // Given: an otherwise-valid transaction whose sender account
            // number is malformed.
            when(transaction.getFromAccountNum()).thenReturn(invalid);
            when(transaction.getToAccountNum()).thenReturn(AUTHED_ACCOUNT_NUM);
            when(transaction.getFromRoutingNum()).thenReturn(VALID_ROUTING_NUM);
            when(transaction.getToRoutingNum()).thenReturn(VALID_ROUTING_NUM);
            when(transaction.getAmount()).thenReturn(VALID_AMOUNT);

            // When, Then
            IllegalArgumentException ex = assertThrows(
                    IllegalArgumentException.class, () ->
                            transactionValidator.validateTransaction(
                                    LOCAL_ROUTING_NUM, AUTHED_ACCOUNT_NUM,
                                    transaction));
            assertNotNull(ex);
            assertEquals(EXCEPTION_MESSAGE_INVALID_NUMBER, ex.getMessage());
        }
    }
}