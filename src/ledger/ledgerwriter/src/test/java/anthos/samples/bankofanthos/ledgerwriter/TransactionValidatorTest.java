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

import static anthos.samples.bankofanthos.ledgerwriter.ExceptionMessages.EXCEPTION_MESSAGE_INVALID_NUMBER;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.when;
import static org.mockito.MockitoAnnotations.initMocks;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.Mock;

class TransactionValidatorTest {

    private static final String LOCAL_ROUTING_NUM = "883745000";
    private static final String AUTHED_ACCOUNT_NUM = "1234567890";
    private static final String VALID_ACCOUNT_NUM = "0987654321";
    private static final String VALID_ROUTING_NUM = "883745000";
    private static final String[] INVALID_ACCT_NUM = {"12345", "abcdefghij", "123456789", "12345678901", ""};

    @Mock
    private Transaction transaction;

    private TransactionValidator transactionValidator;

    @BeforeEach
    void setUp() {
        initMocks(this);
        transactionValidator = new TransactionValidator();
    }

    @Test
    @DisplayName("Given invalid sender account number, IllegalArgumentException is thrown")
    void validationFailsWhenSenderAccountNumberIsInvalid() {
        for (int i = 0; i < INVALID_ACCT_NUM.length; i++) {
            // Given
            when(transaction.getFromAccountNum()).thenReturn(INVALID_ACCT_NUM[i]);
            when(transaction.getFromRoutingNum()).thenReturn(VALID_ROUTING_NUM);
            when(transaction.getToAccountNum()).thenReturn(VALID_ACCOUNT_NUM);
            when(transaction.getToRoutingNum()).thenReturn(VALID_ROUTING_NUM);
            when(transaction.getAmount()).thenReturn(100);

            // When, Then
            IllegalArgumentException ex = assertThrows(
                    IllegalArgumentException.class, () -> {
                        transactionValidator.validateTransaction(
                                LOCAL_ROUTING_NUM, AUTHED_ACCOUNT_NUM, transaction);
                    });
            assertNotNull(ex);
            assertEquals(EXCEPTION_MESSAGE_INVALID_NUMBER, ex.getMessage());
        }
    }
}
