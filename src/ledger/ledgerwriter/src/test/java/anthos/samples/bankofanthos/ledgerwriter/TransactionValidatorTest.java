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
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.when;
import static org.mockito.MockitoAnnotations.initMocks;

class TransactionValidatorTest {

    private TransactionValidator validator;

    @Mock
    private Transaction transaction;

    private static final String LOCAL_ROUTING_NUM = "123456789";
    private static final String AUTHED_ACCOUNT_NUM = "1234567890";
    private static final String VALID_ROUTING_NUM = "987654321";
    private static final String VALID_TO_ACCOUNT_NUM = "9876543210";
    private static final Integer VALID_AMOUNT = 100;

    // Empty, too short, too long, non-numeric and whitespace are all invalid.
    private static final String[] INVALID_NUMBERS = {
        "", "12345", "12345678901", "abcdefghij", "          "
    };

    @BeforeEach
    void setUp() {
        initMocks(this);
        validator = new TransactionValidator();
    }

    @Test
    @DisplayName("Given a malformed sender account number, "
            + "throw IllegalArgumentException for invalid account details")
    void validateTransactionFailsWhenAccountNumberInvalid() {
        for (String invalidNumber : INVALID_NUMBERS) {
            // Given
            when(transaction.getFromAccountNum()).thenReturn(invalidNumber);
            when(transaction.getToAccountNum()).thenReturn(VALID_TO_ACCOUNT_NUM);
            when(transaction.getFromRoutingNum()).thenReturn(LOCAL_ROUTING_NUM);
            when(transaction.getToRoutingNum()).thenReturn(VALID_ROUTING_NUM);
            when(transaction.getAmount()).thenReturn(VALID_AMOUNT);

            // When
            final IllegalArgumentException exception = assertThrows(
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
