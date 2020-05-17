import axios from 'axios';
import { showAlert } from './alerts';

export const bookTour = async tourId => {
    try {
        const stripe = Stripe('pk_test_rOtL3Qw34rceo6qF2ILuB7SI00O44opkKK');
        // Get check out session from API
        // Simple GET request doesnt object
        const session = await axios(`/api/v1/bookings/checkout-session/${tourId}`);
        //console.log(session);

        // Create check out form + charge the credit card
        await stripe.redirectToCheckout({
            sessionId: session.data.session.id
        });
    } catch (err) {
        showAlert('error', err);
    }   
};