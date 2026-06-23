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

import static anthos.samples.bankofanthos.ledgerwriter.ExceptionMessages.EXCEPTION_MESSAGE_INVALID_AMOUNT;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.when;
import static org.mockito.MockitoAnnotations.initMocks;

class TransactionValidatorTest {

    private TransactionValidator transactionValidator;

    @Mock
    private Transaction transaction;

    private static final String LOCAL_ROUTING_NUM = "123456789";
    private static final String AUTHED_ACCOUNT_NUM = "1234567890";
    private static final String TO_ACCOUNT_NUM = "9876543210";
    private static final String TO_ROUTING_NUM = "987654321";
    private static final int[] INVALID_AMOUNTS = {0, -1, -100, Integer.MIN_VALUE};

    @BeforeEach
    void setUp() {
        initMocks(this);
        transactionValidator = new TransactionValidator();
    }

    @Test
    @DisplayName("Given transaction amount is zero or negative, "
            + "IllegalArgumentException is thrown with invalid amount message")
    void validateTransactionFailsWhenAmountIsInvalid() {
        for (int i = 0; i < INVALID_AMOUNTS.length; i++) {
            // Given
            when(transaction.getFromAccountNum()).thenReturn(AUTHED_ACCOUNT_NUM);
            when(transaction.getFromRoutingNum()).thenReturn(LOCAL_ROUTING_NUM);
            when(transaction.getToAccountNum()).thenReturn(TO_ACCOUNT_NUM);
            when(transaction.getToRoutingNum()).thenReturn(TO_ROUTING_NUM);
            when(transaction.getAmount()).thenReturn(INVALID_AMOUNTS[i]);

            // When, Then
            IllegalArgumentException ex = assertThrows(
                    IllegalArgumentException.class, () -> {
                        transactionValidator.validateTransaction(
                                LOCAL_ROUTING_NUM, AUTHED_ACCOUNT_NUM, transaction);
                    });
            assertNotNull(ex);
            assertEquals(EXCEPTION_MESSAGE_INVALID_AMOUNT, ex.getMessage());
        }
    }
}
