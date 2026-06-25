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

    private TransactionValidator validator;

    @Mock
    private Transaction transaction;

    private static final String LOCAL_ROUTING_NUM = "123456789";
    private static final String AUTHED_ACCOUNT_NUM = "1234567890";
    private static final String VALID_ACCT_NUM = "9876543210";
    private static final String VALID_ROUTE_NUM = "987654321";
    private static final String[] INVALID_NUMBERS = {
        "", "123", "12345678901", "abcdefghij", "12345 6789",
    };

    @BeforeEach
    void setUp() {
        initMocks(this);
        validator = new TransactionValidator();
    }

    @Test
    @DisplayName("Given a malformed account or routing number, "
            + "throw IllegalArgumentException with invalid account details")
    void validateTransactionFailsWhenAccountOrRoutingNumberInvalid() {
        for (String invalid : INVALID_NUMBERS) {
            // Given
            when(transaction.getFromAccountNum()).thenReturn(invalid);
            when(transaction.getFromRoutingNum()).thenReturn(VALID_ROUTE_NUM);
            when(transaction.getToAccountNum()).thenReturn(VALID_ACCT_NUM);
            when(transaction.getToRoutingNum()).thenReturn(VALID_ROUTE_NUM);

            // When
            IllegalArgumentException exception = assertThrows(
                    IllegalArgumentException.class,
                    () -> validator.validateTransaction(
                            LOCAL_ROUTING_NUM, AUTHED_ACCOUNT_NUM, transaction));

            // Then
            assertNotNull(exception);
            assertEquals(EXCEPTION_MESSAGE_INVALID_NUMBER,
                    exception.getMessage());
        }
    }
}
