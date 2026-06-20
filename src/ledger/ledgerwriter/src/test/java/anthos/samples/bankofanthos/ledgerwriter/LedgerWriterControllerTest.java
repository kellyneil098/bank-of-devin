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

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.spy;
import static org.mockito.Mockito.when;

import com.auth0.jwt.JWTVerifier;
import com.auth0.jwt.interfaces.Claim;
import com.auth0.jwt.interfaces.DecodedJWT;
import io.micrometer.core.instrument.binder.cache.GuavaCacheMetrics;
import io.micrometer.stackdriver.StackdriverMeterRegistry;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.client.ResourceAccessException;

class LedgerWriterControllerTest {

    private static final String VERSION = "v0.0.0-test";
    private static final String LOCAL_ROUTING_NUM = "883745000";
    private static final String BALANCES_API_URI = "http://balances:8080/balances";
    private static final String AUTHED_ACCOUNT = "1234567890";
    private static final String BEARER_TOKEN = "Bearer valid-token";
    private static final String TOKEN = "valid-token";

    private JWTVerifier verifier;
    private StackdriverMeterRegistry meterRegistry;
    private TransactionRepository transactionRepository;
    private TransactionValidator transactionValidator;
    private LedgerWriterController controller;
    private MockedStatic<GuavaCacheMetrics> guavaCacheMetricsMock;

    @BeforeEach
    void setUp() {
        verifier = mock(JWTVerifier.class);
        meterRegistry = mock(StackdriverMeterRegistry.class);
        transactionRepository = mock(TransactionRepository.class);
        transactionValidator = mock(TransactionValidator.class);

        guavaCacheMetricsMock = mockStatic(GuavaCacheMetrics.class);

        controller = new LedgerWriterController(
                verifier,
                meterRegistry,
                transactionRepository,
                transactionValidator,
                LOCAL_ROUTING_NUM,
                BALANCES_API_URI,
                VERSION);
    }

    @AfterEach
    void tearDown() {
        guavaCacheMetricsMock.close();
    }

    @Test
    void version() {
        ResponseEntity<?> response = controller.version();
        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertEquals(VERSION, response.getBody());
    }

    @Test
    void addTransactionFailsWhenResourceAccessException() {
        DecodedJWT jwt = mock(DecodedJWT.class);
        Claim claim = mock(Claim.class);
        when(claim.asString()).thenReturn(AUTHED_ACCOUNT);
        when(jwt.getClaim(LedgerWriterController.JWT_ACCOUNT_KEY)).thenReturn(claim);
        when(verifier.verify(TOKEN)).thenReturn(jwt);

        Transaction transaction = mock(Transaction.class);
        when(transaction.getFromRoutingNum()).thenReturn(LOCAL_ROUTING_NUM);
        when(transaction.getFromAccountNum()).thenReturn(AUTHED_ACCOUNT);
        when(transaction.getToRoutingNum()).thenReturn("999999999");
        when(transaction.getToAccountNum()).thenReturn("9876543210");
        when(transaction.getAmount()).thenReturn(100);
        when(transaction.getRequestUuid()).thenReturn("unique-uuid");

        LedgerWriterController spyController = spy(controller);
        String errorMsg = "Connection refused";
        doThrow(new ResourceAccessException(errorMsg))
                .when(spyController).getAvailableBalance(TOKEN, AUTHED_ACCOUNT);

        ResponseEntity<?> response = spyController.addTransaction(BEARER_TOKEN, transaction);

        assertEquals(HttpStatus.INTERNAL_SERVER_ERROR, response.getStatusCode());
        assertEquals(errorMsg, response.getBody());
    }
}
