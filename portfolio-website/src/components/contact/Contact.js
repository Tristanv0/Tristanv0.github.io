import React, { useRef, useState } from 'react';
import './Contact.css';
import Container from 'react-bootstrap/Container';
import emailjs from '@emailjs/browser';

const Contact = () => {
    const form = useRef();
    const [isEmailSent, setIsEmailSent] = useState(false);
    const [isEmailSentFail, setIsEmailSentFail] = useState(false);

    const sendEmail = (e) => {
        e.preventDefault();

        emailjs.sendForm('service_sahxgfh', 'template_blrw6hc', form.current, 'WrivdiSFuL1utf1eu')
        .then((result) => {
            console.log(result.text);
            setIsEmailSent(true);
        }, (error) => {
            console.log(error.text);
            setIsEmailSentFail(true);
        });
    };

    return (
        <div className="ContactPage">

                <Container className="title">
                    <p className="contact-title">Contact Me!</p>
                </Container>
                <Container className="container-form">
                    <form ref={form} onSubmit={sendEmail}>
                        <div className="userid">
                            <label>Name:</label>
                            <input
                                type="text"
                                name="from_name"
                                placeholder='Your Name'
                                required
                            />
                            <br/>
                            <br/>
                            <label>Email:</label>
                            <input
                                type="email"
                                name="user_email"
                                placeholder='example@gmail.com'
                                required
                            />
                        </div>
                        <br/>
                        <label>Subject:</label>
                        <input
                            type="subject"
                            name="subject"
                            placeholder='Optional'
                        />
                        <br/>
                        <br/>
                        <label>Message:</label>
                        <textarea
                            name="message"
                            placeholder='Type your message here...'
                            required
                        ></textarea>
                        {isEmailSent && (
                            <p><code className='success-message'>Your email has been sent successfully!</code></p>
                        )}
                        {isEmailSentFail && (
                            <p><code className='fail-message'>An error occured while trying to send your email! Refresh the page or try again later.</code></p>
                        )}
                        <button type="submit" value="Send">Submit</button>
                    </form>

                </Container>
        </div>
    );
};

export default Contact;