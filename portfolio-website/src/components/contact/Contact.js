import React, { useState } from 'react';
import './Contact.css';
import Container from 'react-bootstrap/Container';

const Contact = () => {
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        message: '',
    });

    const handleChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value,
        });
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        // For demonstration purposes, log the form data to the console
        console.log('Form Data:', formData);
        // You can add logic here to send the form data to a server or perform other actions
    };

    return (
        <div className="ContactPage">

                <Container className="title">
                    <p className="contact-title">Contact Me!</p>
                </Container>
                <Container className="container-form">
                    <form onSubmit={handleSubmit}>
                        <label className="userid" htmlFor="name">Name:</label>
                        <input
                            type="text"
                            id="name"
                            name="name"
                            value={formData.name}
                            onChange={handleChange}
                            required
                        />
                        <br></br>
                        <br></br>
                        <label className="userid" htmlFor="email">Email:</label>
                        <input
                            type="email"
                            id="email"
                            name="email"
                            value={formData.email}
                            onChange={handleChange}
                            required
                        />
                        <br></br>
                        <br></br>
                        <label htmlFor="message">Message:</label>
                        <textarea
                            id="message"
                            name="message"
                            value={formData.message}
                            onChange={handleChange}
                            required
                        ></textarea>

                        <button type="submit">Submit</button>
                    </form>
                </Container>

        </div>
    );
};

export default Contact;